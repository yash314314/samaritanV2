import { strict as assert } from "node:assert";
import { classifyCalendarEvent, detectMeetingActivity, mergeIntervals } from "../services/calendarClassifier";

const settings = {
  meetingKeyword: "#rize-meeting",
  focusKeyword: "#rize-focus",
  breakKeyword: "#rize-break",
  attendeeThreshold: 2,
};

assert.equal(classifyCalendarEvent({ title: "Client sync", attendeeCount: 3 }, settings), "meeting");
assert.equal(classifyCalendarEvent({ title: "Solo hold", attendeeCount: 1 }, settings), null);
assert.equal(classifyCalendarEvent({ title: "Solo #rize-meeting", attendeeCount: 1 }, settings), "meeting");
assert.equal(classifyCalendarEvent({ title: "Plan #rize-focus" }, settings), "focus");
assert.equal(classifyCalendarEvent({ title: "Lunch #rize-break" }, settings), "break");
assert.equal(classifyCalendarEvent({ title: "Declined", attendeeCount: 8, attendeeStatus: "declined" }, settings), null);
assert.equal(classifyCalendarEvent({ title: "Conference", eventType: "meeting" }, settings), "meeting");

assert.ok(detectMeetingActivity({ appName: "Zoom", windowTitle: "Weekly sync" }));
assert.ok(detectMeetingActivity({ appName: "Microsoft Edge", windowTitle: "Meet", domain: "meet.google.com" }));
assert.equal(detectMeetingActivity({ appName: "Microsoft Teams", windowTitle: "Chat" }), null);
assert.ok(detectMeetingActivity({ appName: "Microsoft Teams", windowTitle: "Project call" }));

const merged = mergeIntervals([
  { start: new Date("2026-08-12T10:00:00Z"), end: new Date("2026-08-12T10:05:00Z") },
  { start: new Date("2026-08-12T10:05:20Z"), end: new Date("2026-08-12T10:10:00Z") },
]);
assert.equal(merged.length, 1);
assert.equal(merged[0].durationMs, 10 * 60_000);

console.log("Calendar classifier verification passed");
