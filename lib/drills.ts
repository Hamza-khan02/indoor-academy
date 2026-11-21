// Practice drills / homework: categories, who gets which drill, WhatsApp text.
import { addDays, formatDate, todayISO } from './dates';

export const DRILL_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  BATTING: { label: 'Batting', emoji: '🏏' },
  BOWLING: { label: 'Bowling', emoji: '🎯' },
  FIELDING: { label: 'Fielding', emoji: '🧤' },
  FITNESS: { label: 'Fitness', emoji: '💪' },
  OTHER: { label: 'Other', emoji: '📝' },
};

/** Prisma filter: drills for this student (their batch, or given to them), recent or still due. */
export function drillsForStudent(student: { id: string; batchId: string | null }, today = todayISO()) {
  const recent = new Date(`${addDays(today, -60)}T00:00:00Z`);
  return {
    AND: [
      { OR: [...(student.batchId ? [{ batchId: student.batchId }] : []), { students: { some: { studentId: student.id } } }] },
      { OR: [{ dueOn: { gte: today } }, { createdAt: { gte: recent } }] },
    ],
  };
}

/** True when the drill is meant for this student. */
export function drillTargetsStudent(drill: { batchId: string | null; students: { studentId: string }[] }, student: { id: string; batchId: string | null }) {
  return (drill.batchId !== null && drill.batchId === student.batchId) || drill.students.some((s) => s.studentId === student.id);
}

export function drillShareText(d: { title: string; instructions: string; videoUrl: string | null; dueOn: string | null; category: string }, academyName: string) {
  const c = DRILL_CATEGORIES[d.category] ?? DRILL_CATEGORIES.OTHER;
  const lines = [`*${academyName} – Practice drill* ${c.emoji}`, '', `*${d.title}*`, d.instructions];
  if (d.videoUrl) lines.push('', `Video: ${d.videoUrl}`);
  if (d.dueOn) lines.push('', `Complete by: ${formatDate(d.dueOn)}`);
  lines.push('', 'Mark it done in the parent app.');
  return lines.join('\n');
}
