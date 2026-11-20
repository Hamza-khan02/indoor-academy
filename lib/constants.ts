export const AGE_GROUPS = ['U-10', 'U-12', 'U-14', 'U-16', 'U-19', 'Open'];
export const PLAYING_ROLES = ['Batter', 'Bowler', 'All-rounder', 'WK-Batter'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const COACH_SPECIALIZATIONS = ['Head coach', 'Batting', 'Bowling', 'Fielding', 'Wicket-keeping', 'Fitness'];

export const STUDENT_STATUS: Record<string, string> = { ACTIVE: 'Active', REVIEW: 'Review', INACTIVE: 'Inactive' };
export const ATTENDANCE_STATUS: Record<string, string> = { PRESENT: 'Present', LATE: 'Late', ABSENT: 'Absent' };
export const PAYMENT_METHODS: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', BANK: 'Bank transfer' };
export const TOURNAMENT_STATUS: Record<string, string> = { UPCOMING: 'Upcoming', ONGOING: 'Ongoing', COMPLETED: 'Completed' };
export const USER_ROLES: Record<string, string> = { ADMIN: 'Administrator', COACH: 'Coach' };

/** Attendance goal shown on the dashboard chart. */
export const ATTENDANCE_TARGET = 90;
/** Players under this attendance % (last 30 days) are flagged. */
export const LOW_ATTENDANCE = 75;
