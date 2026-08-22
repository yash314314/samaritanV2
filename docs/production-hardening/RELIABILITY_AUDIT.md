# SamaritanV2 Reliability & Resilience Audit

| Area | Failure Mode | Initial Risk | Expected / Hardened Behavior | Status / Verification |
|---|---|---|---|---|
| **API Error Handling** | Unhandled Route Exceptions | Express default HTML 500 error pages & process crashes | Handled gracefully with global JSON error middleware in `api/src/index.ts` | VERIFIED (Global error handler added) |
| **Focus Session Concurrency** | Double-start / Concurrent Focus Sessions | Duplicate active sessions created in DB | `activateCalendarFocusSession` and `startDeepWorkSession` enforce single active session constraint | VERIFIED (`verifyCalendarFocusLifecycle.ts` passes) |
| **Realtime Dashboard Sync** | WebSocket Disconnect / Network Flap | Stale UI state or broken subscriptions | Reconnect handler in `ws.ts` automatically retries with exponential backoff and re-subscribes listeners | VERIFIED (`ws.ts` reconnect logic verified) |
| **Calendar Reminder Service** | Duplicate Reminder Deliveries | Duplicate desktop notifications | `verifyCalendarReminders.ts` verifies idempotent reminder delivery, snooze, and dismissal | VERIFIED (`verifyCalendarReminders.ts` passes) |
| **Project Time Attribution** | Unattributed Activity Drift | Time tracking lost or unassigned | `verifyProjectTimeAttribution.ts` tests stored aggregation & retroactive rule matching | VERIFIED (`verifyProjectTimeAttribution.ts` passes) |
