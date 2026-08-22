import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  classifyCalendarEvent,
  detectMeetingActivity,
  mergeIntervals,
  CalendarClassifierSettings,
} from "../calendarClassifier";

describe("CalendarClassifier Unit Tests", () => {
  const defaultSettings: CalendarClassifierSettings = {
    meetingKeyword: "sync",
    focusKeyword: "deep work",
    breakKeyword: "lunch",
    attendeeThreshold: 2,
  };

  test("classifyCalendarEvent handles explicit eventType", () => {
    assert.equal(
      classifyCalendarEvent({ title: "Random Title", eventType: "focus" }, defaultSettings),
      "focus"
    );
    assert.equal(
      classifyCalendarEvent({ title: "Random Title", eventType: "meeting" }, defaultSettings),
      "meeting"
    );
  });

  test("classifyCalendarEvent filters all-day and cancelled events", () => {
    assert.equal(
      classifyCalendarEvent({ title: "Deep Work", allDay: true }, defaultSettings),
      null
    );
    assert.equal(
      classifyCalendarEvent({ title: "Sync Meeting", status: "cancelled" }, defaultSettings),
      null
    );
  });

  test("classifyCalendarEvent title keywords & attendee counts", () => {
    assert.equal(
      classifyCalendarEvent({ title: "Team Sync" }, defaultSettings),
      "meeting"
    );
    assert.equal(
      classifyCalendarEvent({ title: "Deep Work Sprint" }, defaultSettings),
      "focus"
    );
    assert.equal(
      classifyCalendarEvent({ title: "Quick Chat", attendeeCount: 3 }, defaultSettings),
      "meeting"
    );
    assert.equal(
      classifyCalendarEvent({ title: "Quick Chat", attendeeCount: 3, attendeeStatus: "declined" }, defaultSettings),
      null
    );
  });

  test("detectMeetingActivity domain and app signals", () => {
    const meetResult = detectMeetingActivity({
      appName: "Chrome",
      windowTitle: "Google Meet - Sprint Planning",
      url: "https://meet.google.com/abc-defg-hij",
    });
    assert.ok(meetResult);
    assert.equal(meetResult.signalType, "meeting_domain");

    const zoomResult = detectMeetingActivity({
      appName: "Zoom.exe",
      windowTitle: "Zoom Meeting",
    });
    assert.ok(zoomResult);
    assert.equal(zoomResult.signalType, "meeting_app");
  });

  test("mergeIntervals gap merging", () => {
    const now = Date.now();
    const intervals = [
      { start: new Date(now), end: new Date(now + 10_000) },
      { start: new Date(now + 15_000), end: new Date(now + 30_000) }, // 5s gap < 60s maxGap
      { start: new Date(now + 100_000), end: new Date(now + 120_000) }, // 70s gap > 60s maxGap
    ];

    const merged = mergeIntervals(intervals, 60_000);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].durationMs, 30_000);
    assert.equal(merged[1].durationMs, 20_000);
  });
});
