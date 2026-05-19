CREATE TABLE "screener_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "screener_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "screener_rules_createdAt_idx" ON "screener_rules"("createdAt" DESC);
