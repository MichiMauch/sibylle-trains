import { NextResponse } from 'next/server';
import type { ConnectionsResponse } from '@/types/transport';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || 'Aarau';
  const to = searchParams.get('to') || 'Zürich HB';
  const via = searchParams.get('via'); // Via station(s)
  const time = searchParams.get('time'); // Format: HH:MM
  const date = searchParams.get('date'); // Format: YYYY-MM-DD
  const limit = searchParams.get('limit') || '3';
  const directOnly = searchParams.get('directOnly') === 'true'; // Filter for direct connections

  try {
    let url = `https://transport.opendata.ch/v1/connections?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`;

    if (via) {
      // Add via parameter - can be multiple stations separated by |
      const viaStations = via.split('|');
      viaStations.forEach(station => {
        url += `&via[]=${encodeURIComponent(station)}`;
      });
    }

    if (time) {
      url += `&time=${encodeURIComponent(time)}`;
    }
    if (date) {
      url += `&date=${encodeURIComponent(date)}`;
    }

    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch connections data');
    }

    const data: ConnectionsResponse = await response.json();

    // Optionally filter for direct connections only
    const filteredConnections = directOnly
      ? data.connections.filter(conn => conn.transfers === 0)
      : data.connections;

    return NextResponse.json({
      ...data,
      connections: filteredConnections
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections data' },
      { status: 500 }
    );
  }
}
