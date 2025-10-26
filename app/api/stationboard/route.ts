import { NextResponse } from 'next/server';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { StationboardResponse, Journey } from '@/types/transport';

const OJP_ENDPOINT = 'https://api.opentransportdata.swiss/ojp20';
const TRANSPORT_API = 'https://transport.opendata.ch/v1/stationboard';
const API_KEY = process.env.OJP_API_KEY;

// Station IDs (DiDok numbers)
const STATION_IDS: Record<string, string> = {
  'Muhen': '8502195',
  'Aarau': '8502113',
  'Zürich HB': '8503000',
};

function buildStopEventRequest(stationId: string, limit: number = 15, datetime?: string): string {
  // Use provided datetime or current time
  const requestTime = datetime ? new Date(datetime).toISOString() : new Date().toISOString();

  const request = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    'OJP': {
      '@_xmlns': 'http://www.vdv.de/ojp',
      '@_xmlns:siri': 'http://www.siri.org.uk/siri',
      '@_version': '2.0',
      'OJPRequest': {
        'siri:ServiceRequest': {
          'siri:RequestTimestamp': requestTime,
          'siri:RequestorRef': 'sbb_abfahrtstafel_prod',
          'OJPStopEventRequest': {
            'siri:RequestTimestamp': requestTime,
            'Location': {
              'PlaceRef': {
                'StopPlaceRef': stationId,
              },
            },
            'Params': {
              'NumberOfResults': limit,
              'StopEventType': 'departure',
              'IncludePreviousCalls': true,
              'IncludeOnwardCalls': true,
              'IncludeRealtimeData': true,
            },
          },
        },
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
  });

  return builder.build(request);
}

// Helper function to extract text from XML text nodes
function extractText(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value['#text']) return String(value['#text']);
  return null;
}

function parseStopEventResponse(xmlData: string, stationName: string, categoryMap: Record<number, { category: string; number: string }> = {}): StationboardResponse {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
  });

  const result = parser.parse(xmlData);
  const delivery = result.OJP?.OJPResponse?.['siri:ServiceDelivery']?.OJPStopEventDelivery;

  if (!delivery) {
    throw new Error('Invalid OJP response structure');
  }

  const stopEvents = Array.isArray(delivery.StopEventResult)
    ? delivery.StopEventResult
    : [delivery.StopEventResult];

  const journeys: Journey[] = stopEvents
    .filter(Boolean)
    .map((event: any) => {
      const stopEvent = event.StopEvent;
      const thisCall = stopEvent.ThisCall?.CallAtStop;
      const service = stopEvent.Service;
      const onwardCalls = stopEvent.OnwardCall || [];
      const previousCalls = stopEvent.PreviousCall || [];

      // Build passList from previous, this, and onward calls
      const passList: any[] = [];

      // Add previous calls
      if (Array.isArray(previousCalls)) {
        previousCalls.forEach((call: any) => {
          const callData = call.CallAtStop;
          passList.push(parseCallAtStop(callData));
        });
      } else if (previousCalls.CallAtStop) {
        passList.push(parseCallAtStop(previousCalls.CallAtStop));
      }

      // Add this call
      if (thisCall) {
        passList.push(parseCallAtStop(thisCall));
      }

      // Add onward calls
      if (Array.isArray(onwardCalls)) {
        onwardCalls.forEach((call: any) => {
          const callData = call.CallAtStop;
          passList.push(parseCallAtStop(callData));
        });
      } else if (onwardCalls.CallAtStop) {
        passList.push(parseCallAtStop(onwardCalls.CallAtStop));
      }

      const departureTime = thisCall?.ServiceDeparture?.TimetabledTime || thisCall?.ServiceArrival?.TimetabledTime;
      const estimatedDepartureTime = thisCall?.ServiceDeparture?.EstimatedTime;
      const delay = calculateDelay(departureTime, estimatedDepartureTime);

      const publishedLineName = extractText(service?.PublishedLineName?.Text) || '';
      const destination = extractText(service?.DestinationText?.Text) || '';

      // Try to get category and number from categoryMap based on departure time
      const depTime = estimatedDepartureTime || departureTime;
      const depTimestamp = depTime ? Math.floor(new Date(depTime).getTime() / 60000) : 0;
      const categoryInfo = depTimestamp ? categoryMap[depTimestamp] : undefined;

      let category: string;
      let number: string;

      if (categoryInfo) {
        // Use category/number from transport.opendata.ch
        category = categoryInfo.category;
        number = categoryInfo.number;
      } else if (publishedLineName) {
        // Fallback to extracting from publishedLineName if available
        const categoryMatch = publishedLineName.match(/^([A-Z]+)/);
        const numberMatch = publishedLineName.match(/(\d+)/);
        category = categoryMatch ? categoryMatch[1] : 'TRAIN';
        number = numberMatch ? numberMatch[1] : '';
      } else {
        // Last resort fallback
        category = 'TRAIN';
        number = '';
      }

      return {
        stop: {
          station: {
            id: extractText(thisCall?.StopPointRef) || '',
            name: extractText(thisCall?.StopPointName?.Text) || '',
            score: null,
            coordinate: {
              type: 'WGS84',
              x: null,
              y: null,
            },
            distance: null,
          },
          arrival: null,
          arrivalTimestamp: null,
          departure: estimatedDepartureTime || departureTime,
          departureTimestamp: new Date(estimatedDepartureTime || departureTime).getTime(),
          delay,
          platform: extractText(thisCall?.PlannedQuay?.Text),
          prognosis: {
            platform: extractText(thisCall?.EstimatedQuay?.Text),
            arrival: null,
            departure: estimatedDepartureTime || null,
            capacity1st: null,
            capacity2nd: null,
          },
          realtimeAvailability: null,
          location: {
            id: extractText(thisCall?.StopPointRef) || '',
            name: extractText(thisCall?.StopPointName?.Text) || '',
            score: null,
            coordinate: {
              type: 'WGS84',
              x: null,
              y: null,
            },
            distance: null,
          },
        },
        name: extractText(service?.JourneyRef) || '',
        category: category,
        subcategory: null,
        categoryCode: null,
        number: number,
        operator: extractText(service?.OperatorRef) || 'SBB',
        to: destination,
        passList,
        capacity1st: null,
        capacity2nd: null,
      };
    });

  return {
    station: {
      id: STATION_IDS[stationName] || '',
      name: stationName,
      score: null,
      coordinate: {
        type: 'WGS84',
        x: stationName === 'Muhen' ? 47.347164 : stationName === 'Aarau' ? 47.391361 : 47.377847,
        y: stationName === 'Muhen' ? 8.046361 : stationName === 'Aarau' ? 8.051284 : 8.540502,
      },
      distance: null,
    },
    stationboard: journeys,
  };
}

// Station coordinates cache (Swiss SBB stations)
const STATION_COORDINATES: Record<string, { x: number; y: number }> = {
  'Muhen': { x: 47.347164, y: 8.046361 },
  'Schöftland': { x: 47.303611, y: 8.049444 },
  'Schöftland Nordweg': { x: 47.306389, y: 8.051389 },
  'Hirschthal': { x: 47.298056, y: 8.053611 },
  'Obermuhen': { x: 47.322222, y: 8.052778 },
  'Mittelmuhen': { x: 47.333056, y: 8.050000 },
  'Untermuhen': { x: 47.343611, y: 8.049167 },
  'Aarau': { x: 47.391361, y: 8.051284 },
  'Zürich HB': { x: 47.378177, y: 8.540192 },
  'Basel SBB': { x: 47.547408, y: 7.589548 },
  'Bern': { x: 46.949076, y: 7.439136 },
  'Lenzburg': { x: 47.385833, y: 8.176944 },
  'Zofingen': { x: 47.287778, y: 7.946944 },
  'Olten': { x: 47.350278, y: 7.906389 },
  'Suhr': { x: 47.372500, y: 8.078056 },
};

function parseCallAtStop(callData: any): any {
  const departureTime = callData?.ServiceDeparture?.TimetabledTime;
  const arrivalTime = callData?.ServiceArrival?.TimetabledTime;
  const estimatedDeparture = callData?.ServiceDeparture?.EstimatedTime;
  const estimatedArrival = callData?.ServiceArrival?.EstimatedTime;

  const stationName = extractText(callData?.StopPointName?.Text);
  const coords = stationName ? STATION_COORDINATES[stationName] : null;

  return {
    station: {
      id: extractText(callData?.StopPointRef),
      name: stationName,
      score: null,
      coordinate: {
        type: 'WGS84',
        x: coords?.x || null,
        y: coords?.y || null,
      },
      distance: null,
    },
    arrival: estimatedArrival || arrivalTime,
    arrivalTimestamp: arrivalTime ? new Date(estimatedArrival || arrivalTime).getTime() : null,
    departure: estimatedDeparture || departureTime,
    departureTimestamp: departureTime ? new Date(estimatedDeparture || departureTime).getTime() : null,
    delay: calculateDelay(departureTime, estimatedDeparture) || calculateDelay(arrivalTime, estimatedArrival) || 0,
    platform: extractText(callData?.PlannedQuay?.Text),
    prognosis: {
      platform: extractText(callData?.EstimatedQuay?.Text),
      arrival: estimatedArrival || null,
      departure: estimatedDeparture || null,
      capacity1st: null,
      capacity2nd: null,
    },
    realtimeAvailability: null,
    location: {
      id: extractText(callData?.StopPointRef),
      name: extractText(callData?.StopPointName?.Text),
      score: null,
      coordinate: {
        type: 'WGS84',
        x: null,
        y: null,
      },
      distance: null,
    },
  };
}

function calculateDelay(planned: string | null, estimated: string | null): number {
  if (!planned || !estimated) return 0;

  const plannedTime = new Date(planned).getTime();
  const estimatedTime = new Date(estimated).getTime();
  const delayMs = estimatedTime - plannedTime;

  return Math.round(delayMs / 60000); // Convert to minutes
}

// Helper to fetch train categories from transport.opendata.ch
async function fetchTrainCategories(station: string, limit: number) {
  try {
    const url = `${TRANSPORT_API}?station=${encodeURIComponent(station)}&limit=${limit}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) return {};

    const data = await response.json();
    const categoryMap: Record<number, { category: string; number: string }> = {};

    // Create a map of departure timestamp (rounded to minute) -> category/number
    data.stationboard?.forEach((journey: any) => {
      const depTime = journey.stop.departure;
      if (depTime) {
        // Round to nearest minute for matching
        const timestamp = Math.floor(new Date(depTime).getTime() / 60000);
        categoryMap[timestamp] = {
          category: journey.category || 'TRAIN',
          number: journey.number || '',
        };
      }
    });

    return categoryMap;
  } catch (error) {
    console.error('Error fetching train categories:', error);
    return {};
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const station = searchParams.get('station') || 'Muhen';
  const limit = parseInt(searchParams.get('limit') || '15');
  const datetime = searchParams.get('datetime') || undefined;

  if (!API_KEY) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  const stationId = STATION_IDS[station];
  if (!stationId) {
    return NextResponse.json(
      { error: `Unknown station: ${station}` },
      { status: 400 }
    );
  }

  try {
    // Fetch train categories from transport.opendata.ch in parallel
    const [categoryMapPromise, ojpDataPromise] = await Promise.all([
      fetchTrainCategories(station, limit * 2), // Fetch more to ensure matches
      (async () => {
        const xmlRequest = buildStopEventRequest(stationId, limit, datetime);
        const response = await fetch(OJP_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            'Authorization': `Bearer ${API_KEY}`,
          },
          body: xmlRequest,
          cache: 'no-store',
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('OJP API error:', errorText);
          throw new Error(`OJP API returned ${response.status}`);
        }

        return response.text();
      })(),
    ]);

    const categoryMap = await categoryMapPromise;
    const xmlResponse = await ojpDataPromise;
    const data = parseStopEventResponse(xmlResponse, station, categoryMap);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching OJP stationboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stationboard data' },
      { status: 500 }
    );
  }
}
