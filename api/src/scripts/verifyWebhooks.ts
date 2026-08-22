import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, IncomingMessage } from "node:http";

import { prisma } from "../prisma";
import {
  createWebhookEndpoint,
  dispatchWebhookEvent,
  listWebhookDeliveries,
  listWebhookEndpoints,
  processDueWebhookDeliveries,
} from "../services/webhookService";

type CapturedRequest = { body: string; headers: IncomingMessage["headers"] };

async function main() {
  const requests: CapturedRequest[] = [];
  const receiver = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      requests.push({ body: Buffer.concat(chunks).toString("utf8"), headers: req.headers });
      res.writeHead(204).end();
    });
  });
  await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  const address = receiver.address();
  assert(address && typeof address === "object");

  const user = await prisma.user.create({ data: { name: "Webhook verifier" } });
  let endpointId: string | null = null;
  try {
    const created = await createWebhookEndpoint(user.id, {
      name: "Local receiver",
      targetUrl: `http://127.0.0.1:${address.port}/events`,
      events: ["project.changed"],
    });
    endpointId = created.id;
    assert.equal(created.secret.length, 64);

    const listed = await listWebhookEndpoints(user.id);
    assert.equal(listed.length, 1);
    assert.equal("secret" in listed[0], false, "endpoint listings must never expose signing secrets");

    const seed = "project-verification-1";
    await dispatchWebhookEvent(user.id, "project.changed", { action: "updated", projectId: "project-1" }, seed);
    await processDueWebhookDeliveries();
    for (let attempt = 0; attempt < 100 && requests.length === 0; attempt += 1) {
      await processDueWebhookDeliveries();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(requests.length, 1, "the receiver should get one request");

    const captured = requests[0];
    assert.equal(captured.headers["x-samaritan-event"], "project.changed");
    assert.equal(
      captured.headers["x-samaritan-signature"],
      `sha256=${createHmac("sha256", created.secret).update(captured.body).digest("hex")}`,
      "signature must cover the exact transmitted body"
    );
    const envelope = JSON.parse(captured.body);
    assert.equal(envelope.event, "project.changed");
    assert.equal(envelope.data.projectId, "project-1");

    let deliveries = await listWebhookDeliveries(user.id, endpointId);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].status, "delivered");
    assert.equal(deliveries[0].attemptCount, 1);
    assert.equal(deliveries[0].responseStatus, 204);

    await dispatchWebhookEvent(user.id, "project.changed", { action: "updated", projectId: "project-1" }, seed);
    await processDueWebhookDeliveries();
    deliveries = await listWebhookDeliveries(user.id, endpointId);
    assert.equal(deliveries.length, 1, "repeated idempotency seeds must not create duplicate deliveries");
    assert.equal(requests.length, 1);
  } finally {
    if (endpointId) await prisma.webhookEndpoint.deleteMany({ where: { id: endpointId } });
    await prisma.user.delete({ where: { id: user.id } });
    await new Promise<void>((resolve, reject) => receiver.close((error) => error ? reject(error) : resolve()));
  }

  console.log("Webhook verification passed: signing, delivery, redaction, and idempotency.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
