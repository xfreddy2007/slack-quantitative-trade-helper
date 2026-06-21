-- CreateTable
CREATE TABLE "schema_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "provider_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" TEXT,
    "rawPath" TEXT,
    "licensePolicy" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_documents" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text/plain',
    "content" TEXT NOT NULL,
    "filePath" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_snapshots" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "volume" BIGINT,
    "changePct" DECIMAL(65,30),
    "timestamp" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRunId" TEXT,

    CONSTRAINT "market_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "totalValueUsd" DECIMAL(65,30),
    "cashPct" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "portfolioSnapshotId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "costBasis" DECIMAL(65,30),
    "avgCost" DECIMAL(65,30),
    "currency" TEXT NOT NULL,
    "strategy" TEXT,
    "targetBucket" TEXT,
    "riskLimits" JSONB,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_targets" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "targetPct" DECIMAL(65,30) NOT NULL,
    "driftThresholdPct" DECIMAL(65,30) NOT NULL,
    "markets" TEXT[],
    "assetTypes" TEXT[],
    "allowedSymbols" TEXT[],
    "restrictedActions" TEXT[],

    CONSTRAINT "allocation_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_analyses" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entities" JSONB,
    "tickers" TEXT[],
    "topics" TEXT[],
    "riskTags" TEXT[],
    "assetClasses" TEXT[],
    "impactDirection" TEXT,
    "severity" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "citations" JSONB,
    "market" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trigger_evaluations" (
    "id" TEXT NOT NULL,
    "eventIds" TEXT[],
    "portfolioSymbols" TEXT[],
    "severity" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "novelty" INTEGER,
    "relevance" INTEGER NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "actionSize" TEXT,
    "rationale" TEXT NOT NULL,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "modelVersion" TEXT,
    "schemaVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trigger_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_recommendations" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "portfolioSnapshotId" TEXT NOT NULL,
    "recommendationDate" TIMESTAMP(3) NOT NULL,
    "observations" TEXT[],
    "recommendedAdjustments" JSONB NOT NULL,
    "noActionRationale" TEXT,
    "riskLevel" INTEGER,
    "confidence" INTEGER,
    "citations" JSONB,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_recommendations" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "suggestedSizeMinPct" DECIMAL(65,30),
    "suggestedSizeMaxPct" DECIMAL(65,30),
    "rationale" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "portfolioSnapshotId" TEXT NOT NULL,
    "evaluationStatus" TEXT NOT NULL DEFAULT 'pending',
    "outcomeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_evaluations" (
    "id" TEXT NOT NULL,
    "paperRecommendationId" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "returnPct" DECIMAL(65,30),
    "volatilityNote" TEXT,
    "drawdownNote" TEXT,
    "disciplineScore" DECIMAL(65,30),
    "disciplineClassification" TEXT,
    "priceDataAvailable" BOOLEAN NOT NULL DEFAULT true,
    "deferredReason" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_messages" (
    "id" TEXT NOT NULL,
    "triggerId" TEXT,
    "slackChannel" TEXT NOT NULL,
    "slackTs" TEXT,
    "renderedText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "postedAt" TIMESTAMP(3),
    "feedback" TEXT,

    CONSTRAINT "slack_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_events" (
    "id" TEXT NOT NULL,
    "slackMessageId" TEXT,
    "paperRecommendationId" TEXT,
    "userId" TEXT,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schema_versions_version_key" ON "schema_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "sources_hash_key" ON "sources"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_targets_bucket_key" ON "allocation_targets"("bucket");

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_providerRunId_fkey" FOREIGN KEY ("providerRunId") REFERENCES "provider_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_portfolioSnapshotId_fkey" FOREIGN KEY ("portfolioSnapshotId") REFERENCES "portfolio_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_analyses" ADD CONSTRAINT "news_analyses_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_recommendations" ADD CONSTRAINT "daily_recommendations_portfolioSnapshotId_fkey" FOREIGN KEY ("portfolioSnapshotId") REFERENCES "portfolio_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_recommendations" ADD CONSTRAINT "paper_recommendations_portfolioSnapshotId_fkey" FOREIGN KEY ("portfolioSnapshotId") REFERENCES "portfolio_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_evaluations" ADD CONSTRAINT "paper_evaluations_paperRecommendationId_fkey" FOREIGN KEY ("paperRecommendationId") REFERENCES "paper_recommendations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_messages" ADD CONSTRAINT "slack_messages_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "trigger_evaluations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_slackMessageId_fkey" FOREIGN KEY ("slackMessageId") REFERENCES "slack_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_paperRecommendationId_fkey" FOREIGN KEY ("paperRecommendationId") REFERENCES "paper_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
