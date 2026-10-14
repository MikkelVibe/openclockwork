import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithProviders } from '../../test-utils';
import * as apiClient from '../../api/client';
import { soloApi, type Installation, type SoloEntry } from '../../api/solo';
import { SoloWeekPage } from './SoloWeekPage';
import { SoloTimesPage } from './SoloTimesPage';
import { SoloDashboardPage } from './SoloDashboardPage';
import { SoloSettingsPage } from './SoloSettingsPage';
import { SoloReportsPage } from './SoloReportsPage';
import { SoloCustomersPage } from './SoloCustomersPage';
import { SoloCalendarPage } from './SoloCalendarPage';
import { SoloProjectsPage } from './SoloProjectsPage';

const fixture = vi.hoisted(() => ({
  installation: null as Installation | null,
  logout: vi.fn(),
  patchUser: vi.fn(),
}));
vi.mock('../../app/auth', () => ({
  useCurrentUser: () => ({
    id: 'owner',
    firstName: 'Alex',
    lastName: 'Example',
    email: 'alex@example.test',
    role: 'HRAdmin',
  }),
  useAuth: () => ({
    user: { id: 'owner' },
    logout: fixture.logout,
    patchUser: fixture.patchUser,
  }),
}));
vi.mock('../../app/installation', () => ({
  useInstallation: () => ({ data: fixture.installation, refetch: vi.fn() }),
}));

const emptyReport = {
  from: '2026-09-01',
  to: '2026-09-08',
  timeZone: 'Europe/Berlin',
  timeDefinition: 'net_working_time',
  rows: [],
  totals: {
    grossMinutes: 0,
    breakMinutes: 0,
    netMinutes: 0,
    billableNetMinutes: 0,
  },
  openTimerCount: 0,
};
const entry = {
  id: 'entry-1',
  employeeId: 'owner',
  clockIn: '2026-09-08T08:00:00.000Z',
  clockOut: null,
  revision: 7,
  voidedAt: null,
  projectId: null,
  projectName: null,
  serviceOrderId: null,
  activity: null,
  note: null,
  billable: false,
  summary: null,
  captureGroupId: 'capture-1',
  approvalMode: 'Owner',
} as SoloEntry;

beforeEach(() => {
  fixture.logout.mockClear();
  fixture.patchUser.mockClear();
  fixture.installation = {
    mode: 'Solo',
    ownerEmployeeId: 'owner',
    setupCompleted: true,
    revision: 3,
    timeZone: 'Europe/Berlin',
    capabilities: {
      isOwner: true,
      solo: true,
      targets: false,
      leave: false,
      coreTimeHints: false,
      dailyBlock: false,
      gps: false,
    },
    policy: {
      id: 'policy-1',
      effectiveFrom: '2026-09-08',
      targetEnabled: false,
      weeklyTargetMinutes: null,
      workingDays: 31,
      leaveEnabled: false,
      annualLeaveDays: 0,
      carryOverDays: 0,
      carryOverExpiresOn: null,
      leaveAdjustmentDays: 0,
      leaveAdjustmentReason: null,
      leaveAllowanceYear: 2026,
      holidayCalendar: 'NONE',
      holidayDates: [],
      breakRules: [],
      coreTimeHintsEnabled: false,
      frameStart: '00:00',
      frameEnd: '23:59',
      coreTimes: [],
      dailyBlockEnabled: false,
      gpsEnabled: false,
    },
  };
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
  vi.spyOn(soloApi, 'entries').mockResolvedValue([]);
  vi.spyOn(soloApi, 'bookableProjects').mockResolvedValue([]);
  vi.spyOn(soloApi, 'projects').mockResolvedValue([]);
  vi.spyOn(soloApi, 'customers').mockResolvedValue([]);
  vi.spyOn(soloApi, 'report').mockResolvedValue(emptyReport);
  vi.spyOn(soloApi, 'summary').mockResolvedValue({ dailyCredits: [], overtimeMinutes: 10 } as never);
});
afterEach(() => vi.restoreAllMocks());

function currentInstallation(): Installation {
  if (!fixture.installation) throw new Error('Missing installation fixture');
  return fixture.installation;
}
function formContaining(element: HTMLElement) {
  const form = element.closest('form');
  if (!form) throw new Error('Expected a form control');
  return within(form);
}

describe('Solo work flows', () => {
  it('opens correction for an old running timer from the home page', async () => {
    vi.mocked(soloApi.entries).mockResolvedValue([{ ...entry, clockIn: new Date(Date.now() - 13 * 3600000).toISOString() }]);
    renderWithProviders(<SoloDashboardPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vergessenen Timer abschließen' }));
    expect(screen.getByRole('dialog')).toBeDefined();
  });
  it('keeps history unmounted until expanded and requests bounded entries', async () => {
    renderWithProviders(<SoloDashboardPage />);
    await screen.findByRole('button', { name: 'Einstempeln' });
    expect(screen.queryByRole('button', { name: 'Zeit nachtragen' })).toBeNull();
    const details = screen.getByText('Zeithistorie', { selector: 'summary' }).parentElement as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await screen.findByRole('button', { name: 'Zeit nachtragen' });
    expect(vi.mocked(soloApi.entries).mock.calls.every(([, range]) => Boolean(range?.from && range?.to))).toBe(true);
  });
  it('shows credited absence separately from worked time in the week', async () => {
    currentInstallation().capabilities.targets = true;
    vi.mocked(soloApi.summary).mockResolvedValue({ dailyCredits: [{ date: '2026-09-11', minutes: 420, kinds: ['Vacation'] }] } as never);
    renderWithProviders(<SoloWeekPage />);
    fireEvent.change(screen.getByLabelText('Woche mit Datum'), { target: { value: '2026-09-11' } });
    const credit = await screen.findByText('Urlaub');
    expect(credit.parentElement?.textContent).toContain('Gutgeschrieben: 7 h 00 min');
  });
  it.each(['Work', 'Home'])('records %s as working time rather than an excused absence', async (kind) => {
    vi.spyOn(soloApi, 'days').mockResolvedValue([]);
    const manual = vi.spyOn(soloApi, 'manual').mockResolvedValue(entry);
    const absence = vi.spyOn(soloApi, 'saveDay');
    renderWithProviders(<SoloCalendarPage />);
    fireEvent.change(screen.getByLabelText('Kalendermonat'), { target: { value: '2026-09' } });
    fireEvent.click(await screen.findByRole('button', { name: '2026-09-08', exact: true }));
    const types = within(screen.getByRole('group', { name: 'Typ' }));
    expect(types.getAllByRole('button').map((button) => button.textContent)).toEqual(['Arbeit', 'Urlaub', 'Krankheit', 'Homeoffice']);
    fireEvent.click(types.getByRole('button', { name: kind === 'Work' ? 'Arbeit' : 'Homeoffice' }));
    const dialog = within(screen.getByRole('dialog'));
    expect((dialog.getByLabelText('Von · Europe/Berlin') as HTMLInputElement).value).toBe('2026-09-08T08:00');
    fireEvent.click(dialog.getByRole('button', { name: 'Zeit nachtragen' }));
    await waitFor(() => expect(manual).toHaveBeenCalledWith(expect.objectContaining({
      clockIn: '2026-09-08T06:00:00.000Z', clockOut: '2026-09-08T14:00:00.000Z',
      activity: kind === 'Home' ? 'From home' : null,
    })));
    expect(absence).not.toHaveBeenCalled();
  });
  it('opens a clicked calendar day and saves vacation on that date', async () => {
    vi.spyOn(soloApi, 'days').mockResolvedValue([]);
    const save = vi.spyOn(soloApi, 'saveDay').mockResolvedValue({} as never);
    renderWithProviders(<SoloCalendarPage />);
    fireEvent.change(screen.getByLabelText('Kalendermonat'), { target: { value: '2026-09' } });
    fireEvent.click(await screen.findByRole('button', { name: '2026-09-08', exact: true }));
    const dialog = within(screen.getByRole('dialog'));
    expect((dialog.getByLabelText('Von') as HTMLInputElement).value).toBe('2026-09-08');
    expect((dialog.getByLabelText('Bis') as HTMLInputElement).value).toBe('2026-09-08');
    expect(dialog.getByRole('button', { name: 'Urlaub' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(dialog.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(null, expect.objectContaining({
      kind: 'Vacation', from: '2026-09-08', to: '2026-09-08',
    })));
  });
  it('offers a session picker when a clicked day has several records', async () => {
    vi.mocked(soloApi.entries).mockResolvedValue([
      { ...entry, id: 'morning', clockIn: '2026-09-08T06:00:00Z', clockOut: '2026-09-08T10:00:00Z' },
      { ...entry, id: 'afternoon', clockIn: '2026-09-08T10:30:00Z', clockOut: '2026-09-08T14:00:00Z' },
    ]);
    renderWithProviders(<SoloWeekPage />);
    fireEvent.change(screen.getByLabelText('Woche mit Datum'), { target: { value: '2026-09-08' } });
    await screen.findByRole('button', { name: /Buchung korrigieren.*08:00.*12:00/ });
    fireEvent.click(screen.getByRole('button', { name: /^Di.*8.*Sept/ }));
    const picker = within(screen.getByRole('dialog'));
    expect(picker.getByRole('button', { name: /08:00.*12:00.*Buchung korrigieren/ })).toBeDefined();
    fireEvent.click(picker.getByRole('button', { name: /12:30.*16:00.*Buchung korrigieren/ }));
    const editor = within(screen.getAllByRole('dialog').at(-1)!);
    expect((editor.getByLabelText('Von · Europe/Berlin') as HTMLInputElement).value).toBe('2026-09-08T12:30');
  });
  it('combines the clock, week and expandable history without a second timer', async () => {
    renderWithProviders(<SoloDashboardPage />);
    await screen.findByRole('button', { name: 'Einstempeln' });
    expect(screen.getAllByRole('button', { name: 'Einstempeln' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Woche' })).toBeDefined();
    expect(screen.getAllByRole('article')).toHaveLength(7);
    expect(screen.queryByRole('link', { name: /Woche/ })).toBeNull();
    expect(screen.getByText('Zeithistorie', { selector: 'summary' })).toBeDefined();
  });
  it('corrects the clicked week session directly with timezone conversion and its revision', async () => {
    const morning = { ...entry, id: 'morning', clockIn: '2026-09-08T06:00:00Z', clockOut: '2026-09-08T10:00:00Z' };
    vi.mocked(soloApi.entries).mockResolvedValue([
      morning,
      { ...entry, id: 'afternoon', clockIn: '2026-09-08T10:30:00Z', clockOut: '2026-09-08T14:00:00Z' },
    ]);
    const correct = vi.spyOn(soloApi, 'correct').mockResolvedValue(morning);
    renderWithProviders(<SoloWeekPage />);
    fireEvent.change(screen.getByLabelText('Woche mit Datum'), { target: { value: '2026-09-08' } });
    fireEvent.click(await screen.findByRole('button', { name: /Buchung korrigieren.*08:00.*12:00/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect((dialog.getByLabelText('Von · Europe/Berlin') as HTMLInputElement).value).toBe('2026-09-08T08:00');
    expect((dialog.getByLabelText('Bis · Europe/Berlin') as HTMLInputElement).value).toBe('2026-09-08T12:00');
    fireEvent.change(dialog.getByLabelText('Von · Europe/Berlin'), { target: { value: '2026-09-08T08:15' } });
    fireEvent.change(dialog.getByLabelText(/Korrekturgrund/), { target: { value: 'Correct clock-in' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Buchung korrigieren' }));
    await waitFor(() => expect(correct).toHaveBeenCalledWith('morning', expect.objectContaining({
      clockIn: '2026-09-08T06:15:00.000Z', clockOut: '2026-09-08T10:00:00.000Z',
      revision: 7, reason: 'Correct clock-in',
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Woche' })).toBeDefined();
  });
  it('shows each clock session in the working timezone and excludes voided sessions', async () => {
    vi.mocked(soloApi.entries).mockResolvedValue([
      { ...entry, id: 'morning', clockIn: '2026-09-08T06:00:00Z', clockOut: '2026-09-08T10:00:00Z' },
      { ...entry, id: 'afternoon', clockIn: '2026-09-08T10:30:00Z', clockOut: null },
      { ...entry, id: 'voided', clockIn: '2026-09-08T03:00:00Z', voidedAt: '2026-09-08T04:00:00Z' },
    ]);
    renderWithProviders(<SoloWeekPage />);
    fireEvent.change(screen.getByLabelText('Woche mit Datum'), { target: { value: '2026-09-08' } });
    const day = within(await screen.findByRole('article', { name: /Di.*8.*Sept/ }));
    await waitFor(() => expect(day.getByText('08:00')).toBeDefined());
    expect(day.getByText('12:00')).toBeDefined();
    expect(day.getByText('12:30')).toBeDefined();
    expect(day.getByText('Läuft')).toBeDefined();
    expect(day.queryByText('05:00')).toBeNull();
    const monday = within(screen.getByRole('article', { name: /Mo.*7.*Sept/ }));
    expect(monday.queryByText('08:00')).toBeNull();
  });
  it('clocks in without allocation fields or a project lookup', async () => {
    const start = vi.spyOn(soloApi, 'start').mockResolvedValue(entry);
    renderWithProviders(<SoloDashboardPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Einstempeln' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({
      projectId: null, serviceOrderId: null, billable: false,
    })));
    expect(soloApi.bookableProjects).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Projekt')).toBeNull();
    expect(screen.queryByLabelText('Abrechenbar')).toBeNull();
  });
  it('shows seven clickable days and lets an empty day open its dated editor', async () => {
    renderWithProviders(<SoloWeekPage />);
    fireEvent.change(screen.getByLabelText('Woche mit Datum'), { target: { value: '2026-09-09' } });
    const monday = await screen.findByRole('button', { name: /Mo.*7.*Sept/ });
    expect(screen.getAllByRole('article')).toHaveLength(7);
    fireEvent.click(monday);
    const editor = within(screen.getAllByRole('dialog').at(-1)!);
    expect((editor.getByLabelText('Von · Europe/Berlin') as HTMLInputElement).value).toBe('2026-09-07T08:00');
    expect((editor.getByLabelText('Bis · Europe/Berlin') as HTMLInputElement).value).toBe('2026-09-07T16:00');
    fireEvent.click(editor.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vorherige Woche' }));
    await waitFor(() => expect(soloApi.report).toHaveBeenCalledWith(new URLSearchParams({ from: '2026-08-31', to: '2026-09-06' })));
  });
  it('does not query or display inactive personal accounts', async () => {
    const summary = vi.spyOn(soloApi, 'summary');
    renderWithProviders(<SoloDashboardPage />);
    await screen.findByRole('button', { name: 'Einstempeln' });
    expect(summary).not.toHaveBeenCalled();
    expect(screen.queryByText('Sollzeit')).toBeNull();
    expect(screen.queryByText('Urlaub verfügbar')).toBeNull();
  });
  it('sends the running timer identity and revision when stopping', async () => {
    vi.mocked(soloApi.entries).mockResolvedValue([entry]);
    const stop = vi
      .spyOn(soloApi, 'stop')
      .mockResolvedValue({ ...entry, clockOut: '2026-09-08T09:00:00Z' });
    renderWithProviders(<SoloTimesPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ausstempeln' }),
    );
    await waitFor(() => expect(stop).toHaveBeenCalledWith('entry-1', 7));
  });
  it('records a manual interval with zone conversion and a separate private note', async () => {
    const manual = vi.spyOn(soloApi, 'manual').mockResolvedValue(entry);
    renderWithProviders(<SoloTimesPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Zeit nachtragen' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Von · Europe/Berlin'), {
      target: { value: '2026-09-01T09:00' },
    });
    fireEvent.change(dialog.getByLabelText('Bis · Europe/Berlin'), {
      target: { value: '2026-09-01T11:00' },
    });
    fireEvent.change(dialog.getByLabelText(/Private Notiz/), {
      target: { value: 'Internal reminder' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Zeit nachtragen' }));
    await waitFor(() =>
      expect(manual).toHaveBeenCalledWith(
        expect.objectContaining({
          clockIn: '2026-09-01T07:00:00.000Z',
          clockOut: '2026-09-01T09:00:00.000Z',
          activity: null,
          note: 'Internal reminder',
          billable: false,
        }),
      ),
    );
  });
  it('retains the editor and explains a conflicting correction', async () => {
    vi.mocked(soloApi.entries).mockResolvedValue([
      {
        ...entry,
        clockIn: '2026-09-08T08:00:00.456Z',
        clockOut: '2026-09-08T09:00:00.789Z',
      },
    ]);
    const correct = vi
      .spyOn(soloApi, 'correct')
      .mockRejectedValue(
        new apiClient.ApiError(
          409,
          'Time entry changed; reload before editing',
        ),
      );
    renderWithProviders(<SoloTimesPage />, { initialPath: '/?from=2026-09-01&to=2026-09-30' });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Buchung korrigieren' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText(/Korrekturgrund/), {
      target: { value: 'Correct end time' },
    });
    fireEvent.click(
      dialog.getByRole('button', { name: 'Buchung korrigieren' }),
    );
    await waitFor(() =>
      expect(correct).toHaveBeenCalledWith(
        'entry-1',
        expect.objectContaining({
          revision: 7,
          reason: 'Correct end time',
          clockIn: '2026-09-08T08:00:00.456Z',
          clockOut: '2026-09-08T09:00:00.789Z',
        }),
      ),
    );
    expect(
      await screen.findByText(/Der Datensatz wurde inzwischen geändert/),
    ).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();
  });
  it('disables online writes when the browser is offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    renderWithProviders(<SoloTimesPage />);
    const start = await screen.findByRole('button', { name: 'Einstempeln' });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Du bist offline/)).toBeDefined();
  });
  it('shows actionable translated mode-switch blockers', async () => {
    vi.spyOn(soloApi, 'modePreview').mockResolvedValue({
      allowed: false,
      blockers: ['OPEN_TIME_ENTRIES'],
    });
    renderWithProviders(<SoloSettingsPage />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Wechsel zu Team prüfen' }),
    );
    expect(
      await screen.findByText('Alle laufenden Timer zuerst abschließen.'),
    ).toBeDefined();
    expect(
      screen.queryByRole('button', { name: 'Moduswechsel durchführen' }),
    ).toBeNull();
  });

  it.each([true, false])(
    'does not claim settings were saved after a mode preview (allowed=%s)',
    async (allowed) => {
      const preview = vi.spyOn(soloApi, 'modePreview').mockResolvedValue({
        allowed,
        blockers: allowed ? [] : ['OPEN_TIME_ENTRIES'],
      });
      const mode = vi.spyOn(soloApi, 'mode');
      const { queryClient } = renderWithProviders(<SoloSettingsPage />);
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      fireEvent.click(
        screen.getByRole('button', { name: 'Wechsel zu Team prüfen' }),
      );
      expect(
        await screen.findByText(
          allowed
            ? 'Die Voraussetzungen für den Wechsel sind erfüllt.'
            : 'Vor dem Wechsel sind folgende Punkte zu klären:',
        ),
      ).toBeDefined();
      expect(preview).toHaveBeenCalledWith('Team');
      expect(screen.queryByText('Gespeichert.')).toBeNull();
      expect(mode).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
    },
  );
  it('never renders a private note in a customer activity report', async () => {
    vi.mocked(soloApi.report).mockResolvedValue({
      ...emptyReport,
      rows: [
        {
          id: 'entry-1',
          date: '2026-09-01',
          clockIn: '2026-09-01T07:00:00Z',
          clockOut: '2026-09-01T08:00:00Z',
          customerId: null,
          customerName: null,
          projectId: null,
          projectCode: null,
          projectName: null,
          serviceOrderId: null,
          orderNo: null,
          orderTitle: null,
          activity: 'Customer work',
          billable: true,
          grossMinutes: 60,
          breakMinutes: 0,
          netMinutes: 60,
          billableNetMinutes: 60,
          note: 'Secret internal note',
        } as never,
      ],
    });
    renderWithProviders(<SoloReportsPage />);
    expect(await screen.findByText('Customer work')).toBeDefined();
    expect(screen.queryByText('Secret internal note')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'CSV herunterladen' }),
    ).toBeDefined();
  });

  it('completes all-off setup only after the working time zone is confirmed', async () => {
    currentInstallation().setupCompleted = false;
    const saved = { ...currentInstallation(), revision: 4 };
    const settings = vi.spyOn(soloApi, 'settings').mockResolvedValue(saved);
    const complete = vi
      .spyOn(soloApi, 'completeSetup')
      .mockResolvedValue({ ...saved, revision: 5, setupCompleted: true });
    renderWithProviders(<SoloSettingsPage />);
    const submit = screen.getByRole('button', {
      name: 'Einrichtung abschließen',
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText('Wochenziel (Stunden)')).toBeNull();
    expect(
      screen.queryByLabelText('Urlaubsanspruch pro Jahr (Tage)'),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('switch', {
        name: /Ich bestätige die Arbeitszeitzone/,
      }),
    );
    fireEvent.click(submit);
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(settings).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 3,
        targetEnabled: false,
        weeklyTargetMinutes: null,
        leaveEnabled: false,
        holidayCalendar: 'NONE',
        holidayDates: [],
        breakRules: [],
        coreTimeHintsEnabled: false,
        dailyBlockEnabled: false,
        gpsEnabled: false,
      }),
    );
    expect(settings.mock.invocationCallOrder[0]).toBeLessThan(
      complete.mock.invocationCallOrder[0],
    );
  });

  it('adds and removes picked holiday dates and saves the Denmark preset', async () => {
    const settings = vi.spyOn(soloApi, 'settings').mockResolvedValue({ ...currentInstallation(), revision: 4 });
    renderWithProviders(<SoloSettingsPage />);
    fireEvent.change(screen.getByLabelText('Feiertagskalender'), { target: { value: 'DK' } });
    const input = screen.getByLabelText('Datum');
    fireEvent.change(input, { target: { value: '2026-12-24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Datum hinzufügen' }));
    expect(screen.getByText('24.12.2026', { selector: 'time' })).toBeDefined();
    fireEvent.change(input, { target: { value: '2026-12-24' } });
    expect((screen.getByRole('button', { name: 'Datum hinzufügen' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen 24.12.2026' }));
    expect(screen.queryByText('24.12.2026', { selector: 'time' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Datum hinzufügen' }));
    fireEvent.click(formContaining(input).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(settings).toHaveBeenCalledWith(expect.objectContaining({ holidayCalendar: 'DK', holidayDates: ['2026-12-24'] })));
  });

  it('saves a future rule version without completing setup again', async () => {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 7);
    const effectiveFrom = future.toISOString().slice(0, 10);
    const settings = vi
      .spyOn(soloApi, 'settings')
      .mockResolvedValue({ ...currentInstallation(), revision: 4 });
    const complete = vi.spyOn(soloApi, 'completeSetup');
    renderWithProviders(<SoloSettingsPage />);
    const date = screen.getByLabelText(/Wirksam ab/);
    fireEvent.change(date, { target: { value: effectiveFrom } });
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Wochenziel und Zeitkonto aktivieren',
      }),
    );
    fireEvent.change(screen.getByLabelText('Wochenziel (Stunden)'), {
      target: { value: '32' },
    });
    const form = formContaining(date);
    fireEvent.click(form.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(settings).toHaveBeenCalledWith(
        expect.objectContaining({
          revision: 3,
          effectiveFrom,
          targetEnabled: true,
          weeklyTargetMinutes: 1920,
          dailyBlockEnabled: false,
        }),
      ),
    );
    expect(complete).not.toHaveBeenCalled();
  });

  it('keeps the chosen future settings after a server conflict', async () => {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 7);
    const effectiveFrom = future.toISOString().slice(0, 10);
    const settings = vi
      .spyOn(soloApi, 'settings')
      .mockRejectedValue(
        new apiClient.ApiError(409, 'Settings changed; reload before saving'),
      );
    const complete = vi.spyOn(soloApi, 'completeSetup');
    renderWithProviders(<SoloSettingsPage />);
    const date = screen.getByLabelText(/Wirksam ab/) as HTMLInputElement;
    fireEvent.change(date, { target: { value: effectiveFrom } });
    fireEvent.click(
      screen.getByRole('switch', { name: 'Urlaubskonto aktivieren' }),
    );
    fireEvent.change(screen.getByLabelText('Urlaubsanspruch pro Jahr (Tage)'), {
      target: { value: '25' },
    });
    fireEvent.click(
      formContaining(date).getByRole('button', { name: 'Speichern' }),
    );
    expect(
      await screen.findByText(/Der Datensatz wurde inzwischen geändert/),
    ).toBeDefined();
    expect(settings).toHaveBeenCalledOnce();
    expect(date.value).toBe(effectiveFrom);
    expect(
      (
        screen.getByLabelText(
          'Urlaubsanspruch pro Jahr (Tage)',
        ) as HTMLInputElement
      ).value,
    ).toBe('25');
    expect(complete).not.toHaveBeenCalled();
  });

  it('retries setup using the confirmed revision after completion fails', async () => {
    currentInstallation().setupCompleted = false;
    const settings = vi
      .spyOn(soloApi, 'settings')
      .mockResolvedValueOnce({ ...currentInstallation(), revision: 4 })
      .mockResolvedValueOnce({ ...currentInstallation(), revision: 5 });
    const complete = vi
      .spyOn(soloApi, 'completeSetup')
      .mockRejectedValueOnce(new apiClient.ApiError(503, 'Service unavailable'))
      .mockResolvedValueOnce({
        ...currentInstallation(),
        revision: 6,
        setupCompleted: true,
      });
    renderWithProviders(<SoloSettingsPage />);
    fireEvent.click(
      screen.getByRole('switch', {
        name: /Ich bestätige die Arbeitszeitzone/,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Einrichtung abschließen' }),
    );
    expect(await screen.findByText(/Service unavailable/)).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: 'Einrichtung abschließen' }),
    );
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
    expect(settings.mock.calls[0][0].revision).toBe(3);
    expect(settings.mock.calls[1][0].revision).toBe(4);
  });

  it('rejects a nonexistent correction time without sending a mutation', async () => {
    vi.mocked(soloApi.entries).mockResolvedValue([
      { ...entry, clockOut: '2026-09-08T09:00:00Z' },
    ]);
    const correct = vi.spyOn(soloApi, 'correct');
    renderWithProviders(<SoloTimesPage />, { initialPath: '/?from=2026-09-01&to=2026-09-30' });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Buchung korrigieren' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Von · Europe/Berlin'), {
      target: { value: '2026-03-29T02:30' },
    });
    fireEvent.change(dialog.getByLabelText(/Korrekturgrund/), {
      target: { value: 'Check actual start' },
    });
    fireEvent.click(
      dialog.getByRole('button', { name: 'Buchung korrigieren' }),
    );
    expect(
      await screen.findByText(/Diese lokale Uhrzeit existiert/),
    ).toBeDefined();
    expect(correct).not.toHaveBeenCalled();
    expect(
      (dialog.getByLabelText(/Korrekturgrund/) as HTMLInputElement).value,
    ).toBe('Check actual start');
  });

  it('downloads the server CSV with only the explicitly applied report filters', async () => {
    const download = vi
      .spyOn(apiClient, 'downloadAuthenticated')
      .mockResolvedValue();
    renderWithProviders(<SoloReportsPage />);
    await screen.findByRole('button', { name: 'CSV herunterladen' });
    fireEvent.change(screen.getByLabelText('Von'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.change(screen.getByLabelText('Bis'), {
      target: { value: '2026-09-08' },
    });
    fireEvent.change(screen.getByLabelText('Abrechenbar'), {
      target: { value: 'true' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Filter anwenden' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'CSV herunterladen' }),
    );
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    const [url, name] = download.mock.calls[0];
    const parsed = new URL(url, 'https://openclockwork.test');
    expect(parsed.pathname).toBe('/api/reports/solo.csv');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      from: '2026-09-01',
      to: '2026-09-08',
      billable: 'true',
    });
    expect(name).toBe('openclockwork-2026-09-01-2026-09-08.csv');
    expect(parsed.searchParams.has('note')).toBe(false);
    expect(parsed.searchParams.has('employeeId')).toBe(false);
    expect(await screen.findByText('Download gestartet.')).toBeDefined();
    expect(screen.queryByText('Gespeichert.')).toBeNull();
  });

  it('requires twelve-character passwords and signs out without refetching revoked sessions', async () => {
    const password = vi.spyOn(soloApi, 'password').mockResolvedValue();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { queryClient } = renderWithProviders(<SoloSettingsPage />);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const newPassword = screen.getByLabelText(
      'Neues Passwort (mindestens 12 Zeichen)',
    ) as HTMLInputElement;
    const repeat = screen.getByLabelText(
      'Neues Passwort wiederholen',
    ) as HTMLInputElement;
    expect(newPassword.minLength).toBe(12);
    expect(repeat.minLength).toBe(12);
    fireEvent.change(screen.getByLabelText('Aktuelles Passwort'), {
      target: { value: 'old-synthetic-password' },
    });
    fireEvent.change(newPassword, {
      target: { value: 'new-synthetic-password' },
    });
    fireEvent.change(repeat, { target: { value: 'new-synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort ändern' }));
    await waitFor(() => expect(fixture.logout).toHaveBeenCalledOnce());
    expect(password).toHaveBeenCalledWith(
      'old-synthetic-password',
      'new-synthetic-password',
    );
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('keeps long customer names shrinkable beside the archive status', async () => {
    const name = 'Customer'.repeat(20);
    vi.mocked(soloApi.customers).mockResolvedValue([
      {
        id: 'customer-1',
        name,
        code: null,
        note: null,
        isActive: false,
        projectCount: 1,
      },
    ]);
    renderWithProviders(<SoloCustomersPage />);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Archivierte anzeigen' }),
    );
    const heading = await screen.findByRole('heading', { name });
    expect(heading.classList.contains('min-w-0')).toBe(true);
    expect(heading.classList.contains('break-words')).toBe(true);
    expect(screen.getByText('Archiviert')).toBeDefined();
  });

  it('explains why a customer with a running timer cannot be archived', async () => {
    vi.mocked(soloApi.customers).mockResolvedValue([
      {
        id: 'customer-1',
        name: 'Example customer',
        code: null,
        note: null,
        isActive: true,
        projectCount: 1,
      },
    ]);
    const detail =
      'Finish or reassign the running timer before archiving this customer';
    const save = vi
      .spyOn(soloApi, 'saveCustomer')
      .mockRejectedValue(new apiClient.ApiError(409, detail));
    renderWithProviders(<SoloCustomersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archivieren' }));
    expect(
      await screen.findByText(
        'Ein laufender Timer verwendet diesen Datensatz. Beende den Timer oder ändere seine Zuordnung, bevor du archivierst.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(detail, { exact: false })).toBeNull();
    expect(screen.queryByText(/überschneiden sich/)).toBeNull();
    expect(save).toHaveBeenCalledWith(
      'customer-1',
      expect.objectContaining({ isActive: false }),
    );
    expect(screen.getByRole('button', { name: 'Archivieren' })).toBeDefined();
  });

  it('explains a timer already stopped in another tab without an overlap warning', async () => {
    vi.mocked(soloApi.entries).mockResolvedValue([entry]);
    const stop = vi
      .spyOn(soloApi, 'stop')
      .mockRejectedValue(
        new apiClient.ApiError(404, 'No open time entry to close'),
      );
    renderWithProviders(<SoloTimesPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ausstempeln' }),
    );
    expect(
      await screen.findByText(
        'Der Timer wurde bereits beendet. Aktualisiere die Ansicht.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/No open time entry/)).toBeNull();
    expect(screen.queryByText(/überschneiden sich/)).toBeNull();
    expect(stop).toHaveBeenCalledWith('entry-1', 7);
  });

  it('confirms the exact calendar entry and revision before cancelling it', async () => {
    vi.spyOn(soloApi, 'days').mockResolvedValue([
      {
        id: 'day-1',
        kind: 'Free',
        from: '2026-09-07',
        to: '2026-09-07',
        note: null,
        halfDayStart: false,
        halfDayEnd: false,
        revision: 4,
        cancelledAt: null,
      },
    ]);
    const cancel = vi
      .spyOn(soloApi, 'cancelDay')
      .mockImplementation(async () => ({
        ...(await soloApi.days())[0],
        revision: 5,
        cancelledAt: '2026-09-08T08:00:00Z',
      }));
    const nativeConfirm = vi.spyOn(window, 'confirm');
    renderWithProviders(<SoloCalendarPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Stornieren' }));
    expect(cancel).not.toHaveBeenCalled();
    const dialog = within(
      screen.getByRole('dialog', { name: 'Kalendereintrag stornieren?' }),
    );
    expect(dialog.getByText(/7\.9\.2026/)).toBeDefined();
    fireEvent.click(dialog.getByRole('button', { name: 'Bestätigen' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('day-1', 4));
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('defers unused customer deletion until explicit in-app confirmation', async () => {
    vi.mocked(soloApi.customers).mockResolvedValue([
      {
        id: 'customer-1',
        name: 'Example customer',
        code: 'EX',
        note: null,
        isActive: true,
        projectCount: 0,
      },
    ]);
    const remove = vi
      .spyOn(soloApi, 'deleteCustomer')
      .mockResolvedValue(undefined);
    renderWithProviders(<SoloCustomersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen' }));
    expect(remove).not.toHaveBeenCalled();
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Kunden: Example customer · EX')).toBeDefined();
    fireEvent.click(dialog.getByRole('button', { name: 'Bestätigen' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('customer-1'));
  });

  it.each(['project', 'order'] as const)(
    'confirms the exact unused %s before deletion',
    async (kind) => {
      vi.mocked(soloApi.projects).mockResolvedValue([
        {
          id: 'project-1',
          code: 'PROJ',
          name: 'Example project',
          description: null,
          isActive: true,
          planHours: null,
          customerId: null,
          customerName: null,
          defaultBillable: false,
          bookedMinutes: 0,
          assignedEmployeeCount: 1,
          updatedAt: '2026-09-08T08:00:00Z',
          serviceOrders: [
            {
              id: 'order-1',
              projectId: 'project-1',
              orderNo: '01',
              title: 'Example order',
              isActive: true,
              planHours: null,
              defaultBillable: null,
              bookedMinutes: 0,
            },
          ],
        },
      ]);
      const deleteProject = vi
        .spyOn(apiClient.api, 'deleteProject')
        .mockResolvedValue(undefined);
      const deleteOrder = vi
        .spyOn(apiClient.api, 'deleteServiceOrder')
        .mockResolvedValue(undefined);
      renderWithProviders(<SoloProjectsPage />);
      const buttons = await screen.findAllByRole('button', { name: 'Löschen' });
      fireEvent.click(buttons[kind === 'project' ? 0 : 1]);
      expect(deleteProject).not.toHaveBeenCalled();
      expect(deleteOrder).not.toHaveBeenCalled();
      const dialog = within(screen.getByRole('dialog'));
      expect(
        dialog.getByText(
          kind === 'project'
            ? 'PROJ · Example project'
            : 'PROJ · Example project / 01 · Example order',
        ),
      ).toBeDefined();
      fireEvent.click(dialog.getByRole('button', { name: 'Bestätigen' }));
      if (kind === 'project') {
        await waitFor(() =>
          expect(deleteProject).toHaveBeenCalledWith('project-1'),
        );
        expect(deleteOrder).not.toHaveBeenCalled();
      } else {
        await waitFor(() =>
          expect(deleteOrder).toHaveBeenCalledWith('project-1', 'order-1'),
        );
        expect(deleteProject).not.toHaveBeenCalled();
      }
    },
  );
});
