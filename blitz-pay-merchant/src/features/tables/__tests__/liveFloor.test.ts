import { createSseParser, type SseEvent } from '../sseParser';
import { applyTableEvent, pinCaption, summarizeFloor } from '../tableLogic';
import type { BranchFloor, TableLive } from '../types/table';

function live(id: string, overrides: Partial<TableLive> = {}, seats: number | null = 4): TableLive {
  return {
    table: { id, code: `C${id}`, name: id, active: true, link: '', seats, placement: null },
    status: 'FREE',
    occupiedSince: null,
    guestCount: null,
    orders: [],
    ...overrides,
  };
}

function floorOf(tables: TableLive[], branchCapacity: number | null = 20): BranchFloor {
  return { floorPlans: [], tables, summary: summarizeFloor(tables, branchCapacity) };
}

describe('sse parser', () => {
  it('emits events split across chunks, with multi-line data and comments', () => {
    const events: SseEvent[] = [];
    const push = createSseParser((event) => events.push(event));
    push(': keep-alive\n\nevent: ta');
    push('ble\ndata: {"a":\ndata: 1}\r\n\r\n');
    push('data: plain\n\n');
    expect(events).toEqual([
      { event: 'table', data: '{"a":\n1}' },
      { event: 'message', data: 'plain' },
    ]);
  });
});

describe('live floor events', () => {
  it('replaces a table and recomputes guests and occupancy', () => {
    const floor = floorOf([live('1'), live('2', {}, 2)]);
    const next = applyTableEvent(floor, live('1', { status: 'OCCUPIED', guestCount: 3 }));
    expect(next.tables[0].guestCount).toBe(3);
    expect(next.summary).toEqual({
      totalTables: 2,
      occupiedTables: 1,
      seatedCapacity: 6,
      occupiedSeats: 4,
      totalGuests: 3,
      branchCapacity: 20,
    });
  });

  it('adds new tables and drops deactivated ones', () => {
    const floor = floorOf([live('1')]);
    const added = applyTableEvent(floor, live('2'));
    expect(added.tables.map((t) => t.table.id)).toEqual(['1', '2']);
    const deactivated = live('1');
    deactivated.table.active = false;
    expect(applyTableEvent(added, deactivated).tables.map((t) => t.table.id)).toEqual(['2']);
  });

  it('shows guests and seats on live pins', () => {
    expect(pinCaption('5', 4, 3)).toBe('5 · 3/4');
    expect(pinCaption('5', 4, null)).toBe('5 · –/4');
    expect(pinCaption('5', null, 2)).toBe('5 · 2/?');
  });
});
