import type {
  Content,
  ContentTable,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import type { LocationPoint } from './dto/location-point.dto';

export const COMPOSITION_LABELS: Record<string, string> = {
  men_only: 'Solo hombres',
  mixed: 'Mixto',
  women_only: 'Solo mujeres',
};

export interface ScheduleActivityItem {
  date: string;
  start_time: string;
  end_time: string;
  name: string;
  description: string | null;
  locations: LocationPoint[];
  is_preaching_shift: boolean;
  is_food_shift: boolean;
  preaching_group_name: string | null;
  is_congregation_meeting?: boolean;
  congregation_address?: string | null;
  congregation_lat?: number | null;
  congregation_lng?: number | null;
  status?: 'draft' | 'published';
}

export interface ScheduleGroupInfo {
  group_code: string;
  composition: 'men_only' | 'mixed' | 'women_only' | null;
  guest_count: number;
  host_name: string | null;
  contact_name: string | null;
  contact_code: string | null;
}

const cellLayout = {
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

export const SCHEDULE_PDF_STYLES: TDocumentDefinitions['styles'] = {
  title: { fontSize: 16, bold: true, margin: [0, 0, 0, 2] },
  subtitle: { fontSize: 9, color: '#666666', margin: [0, 0, 0, 16] },
  groupTitle: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
  groupContact: { fontSize: 9, color: '#444444', margin: [0, 0, 0, 4] },
  groupSubtitle: { fontSize: 9, color: '#666666', margin: [0, 0, 0, 12] },
  tableHeader: { fontSize: 9, bold: true, fillColor: '#f0f0f0' },
  dayHeader: {
    fontSize: 10,
    bold: true,
    fillColor: '#eef2ff',
    color: '#1e3a8a',
  },
  tableCell: { fontSize: 9 },
  emptyCell: { fontSize: 9, italics: true, color: '#999999' },
  activityName: { fontSize: 9, bold: true },
  activityMeta: { fontSize: 8, color: '#666666', italics: true },
  meetingCell: { fontSize: 9, fillColor: '#fffbeb', color: '#78350f' },
  meetingName: {
    fontSize: 9,
    bold: true,
    fillColor: '#fffbeb',
    color: '#78350f',
  },
};

const DAYS_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const label = `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function locationsText(locations: LocationPoint[]): string {
  if (locations.length === 0) return '—';
  return locations.map((l) => l.address).join('\n');
}

export interface ScheduleVolunteerInfo {
  volunteer_code: string;
  full_name: string;
}

export interface BuildGroupScheduleContentOptions {
  /** Show composition, guest count and host as a subtitle under the group title. Defaults to true. */
  showGroupInfo?: boolean;
}

export function buildGroupScheduleContent(
  group: ScheduleGroupInfo,
  days: string[],
  activities: ScheduleActivityItem[],
  options: BuildGroupScheduleContentOptions = {},
): Content[] {
  const content: Content[] = [];

  const { showGroupInfo = true } = options;

  content.push({ text: `Grupo ${group.group_code}`, style: 'groupTitle' });

  if (group.contact_name || group.contact_code) {
    const contactLabel = [group.contact_name, group.contact_code]
      .filter(Boolean)
      .join(' · ');
    content.push({
      text: `Contacto de grupo: ${contactLabel}`,
      style: 'groupContact',
    });
  }

  if (showGroupInfo) {
    const subtitleParts = [
      group.composition ? COMPOSITION_LABELS[group.composition] : null,
      `${group.guest_count} persona${group.guest_count !== 1 ? 's' : ''}`,
      group.host_name ? `Hospedados en: ${group.host_name}` : null,
    ].filter(Boolean);

    content.push({
      text: subtitleParts.join('   ·   '),
      style: 'groupSubtitle',
    });
  } else {
    content.push({ text: '', style: 'groupSubtitle' });
  }

  if (days.length === 0) {
    content.push({ text: 'No hay actividades programadas para este grupo.' });
    return content;
  }

  const activitiesByDay = new Map<string, ScheduleActivityItem[]>();
  for (const activity of activities) {
    const list = activitiesByDay.get(activity.date) ?? [];
    list.push(activity);
    activitiesByDay.set(activity.date, list);
  }

  const body: ContentTable['table']['body'] = [
    [
      { text: 'Hora', style: 'tableHeader' },
      { text: 'Actividad', style: 'tableHeader' },
      { text: 'Lugar', style: 'tableHeader' },
    ],
  ];

  for (const day of days) {
    body.push([
      { text: dayLabel(day), style: 'dayHeader', colSpan: 3 },
      {},
      {},
    ]);

    const dayActivities = activitiesByDay.get(day) ?? [];
    if (dayActivities.length === 0) {
      body.push([
        { text: 'Sin actividades programadas', style: 'emptyCell', colSpan: 3 },
        {},
        {},
      ]);
      continue;
    }

    for (const activity of dayActivities) {
      const timeText = activity.end_time
        ? `${activity.start_time} - ${activity.end_time}`
        : activity.start_time;

      if (activity.is_congregation_meeting) {
        let locationContent: Content;
        if (
          activity.congregation_address &&
          activity.congregation_lat &&
          activity.congregation_lng
        ) {
          locationContent = {
            text: [
              {
                text: activity.congregation_address + ' ',
                style: 'meetingCell',
              },
              {
                text: '(Maps)',
                link: `https://www.google.com/maps?q=${activity.congregation_lat},${activity.congregation_lng}`,
                style: 'meetingCell',
                decoration: 'underline',
              },
            ],
          } as Content;
        } else if (activity.congregation_address) {
          locationContent = {
            text: activity.congregation_address,
            style: 'meetingCell',
          };
        } else {
          locationContent = { text: '—', style: 'meetingCell' };
        }
        body.push([
          { text: timeText, style: 'meetingCell' },
          { text: activity.name, style: 'meetingName' },
          locationContent,
        ]);
        continue;
      }

      const nameStack: Content[] = [
        { text: activity.name, style: 'activityName' },
      ];
      if (activity.is_preaching_shift && activity.preaching_group_name) {
        nameStack.push({
          text: activity.preaching_group_name,
          style: 'activityMeta',
        });
      }
      if (activity.description) {
        nameStack.push({ text: activity.description, style: 'activityMeta' });
      }

      body.push([
        { text: timeText, style: 'tableCell' },
        { stack: nameStack },
        {
          text: activity.is_food_shift ? '' : locationsText(activity.locations),
          style: 'tableCell',
        },
      ]);
    }
  }

  content.push({
    table: { headerRows: 1, widths: [70, '*', '*'], body },
    layout: cellLayout,
    margin: [0, 0, 0, 12],
  });

  return content;
}

export function buildVolunteerScheduleContent(
  volunteer: ScheduleVolunteerInfo,
  days: string[],
  activities: ScheduleActivityItem[],
): Content[] {
  const content: Content[] = [];

  content.push({
    text: `${volunteer.volunteer_code} – ${volunteer.full_name}`,
    style: 'groupTitle',
  });
  content.push({ text: '', style: 'groupSubtitle' });

  if (days.length === 0) {
    content.push({
      text: 'No hay actividades programadas para este voluntario.',
    });
    return content;
  }

  const activitiesByDay = new Map<string, ScheduleActivityItem[]>();
  for (const activity of activities) {
    const list = activitiesByDay.get(activity.date) ?? [];
    list.push(activity);
    activitiesByDay.set(activity.date, list);
  }

  const body: ContentTable['table']['body'] = [
    [
      { text: 'Hora', style: 'tableHeader' },
      { text: 'Actividad', style: 'tableHeader' },
      { text: 'Lugar', style: 'tableHeader' },
    ],
  ];

  for (const day of days) {
    body.push([
      { text: dayLabel(day), style: 'dayHeader', colSpan: 3 },
      {},
      {},
    ]);

    const dayActivities = activitiesByDay.get(day) ?? [];
    if (dayActivities.length === 0) {
      body.push([
        { text: 'Sin actividades programadas', style: 'emptyCell', colSpan: 3 },
        {},
        {},
      ]);
      continue;
    }

    for (const activity of dayActivities) {
      const timeText = activity.end_time
        ? `${activity.start_time} - ${activity.end_time}`
        : activity.start_time;

      const nameStack: Content[] = [
        { text: activity.name, style: 'activityName' },
      ];
      if (activity.is_preaching_shift && activity.preaching_group_name) {
        nameStack.push({
          text: activity.preaching_group_name,
          style: 'activityMeta',
        });
      }
      if (activity.description) {
        nameStack.push({ text: activity.description, style: 'activityMeta' });
      }

      body.push([
        { text: timeText, style: 'tableCell' },
        { stack: nameStack },
        {
          text: activity.is_food_shift ? '' : locationsText(activity.locations),
          style: 'tableCell',
        },
      ]);
    }
  }

  content.push({
    table: { headerRows: 1, widths: [70, '*', '*'], body },
    layout: cellLayout,
    margin: [0, 0, 0, 12],
  });

  return content;
}
