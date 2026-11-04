-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('PUBLIC_FORM', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('RECEIVED', 'WAITING_ASSESSMENT', 'READY_TO_QUOTE', 'QUOTED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteRequestSource" AS ENUM ('PUBLIC_FORM', 'INTERNAL');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "QuoteClosureReason" AS ENUM ('CLIENT_REJECTED', 'SUPERSEDED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "QuoteLineKind" AS ENUM ('AREA', 'EXTRA', 'LABOR', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED', 'WAIVED');

-- CreateEnum
CREATE TYPE "ServiceFrequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "VisitKind" AS ENUM ('INITIAL', 'MAINTENANCE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "KindSuggestionReason" AS ENUM ('GAP_THRESHOLD');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('BEFORE', 'AFTER', 'OTHER');

-- CreateEnum
CREATE TYPE "PhotoVisibility" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "ChecklistRunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'REVISIT_SCHEDULED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3', 'OCI');

-- CreateEnum
CREATE TYPE "CancellationReference" AS ENUM ('WINDOW_START');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reference" "CancellationReference" NOT NULL DEFAULT 'WINDOW_START',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicyTier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "upToHours" INTEGER,
    "feePercent" DECIMAL(5,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CancellationPolicyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceLeadId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "stateRegion" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accessNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bedrooms" INTEGER,
    "bathrooms" DECIMAL(3,1),
    "kitchens" INTEGER,
    "sqft" INTEGER,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "propertyId" TEXT,
    "requiresAssessment" BOOLEAN NOT NULL DEFAULT false,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "source" "QuoteRequestSource" NOT NULL,
    "clientInput" JSONB NOT NULL,
    "operationalScope" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAssessment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL,
    "scheduledDate" DATE,
    "windowStart" TIME(0),
    "windowEnd" TIME(0),
    "workerId" TEXT,
    "scheduledByUserId" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "waivedByUserId" TEXT,
    "waivedAt" TIMESTAMPTZ(3),
    "waiveReason" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PropertyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "validUntil" DATE,
    "internalNotes" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "sentByUserId" TEXT,
    "acceptedAt" TIMESTAMPTZ(3),
    "closureReason" "QuoteClosureReason",
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "kind" "QuoteLineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOffering" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ServiceOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "offeringId" TEXT,
    "quoteId" TEXT,
    "number" INTEGER NOT NULL,
    "frequency" "ServiceFrequency" NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "visitKind" "VisitKind" NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" DATE NOT NULL,
    "windowStart" TIME(0) NOT NULL,
    "windowEnd" TIME(0) NOT NULL,
    "actualStartedAt" TIMESTAMPTZ(3),
    "actualEndedAt" TIMESTAMPTZ(3),
    "estimatedDurationMinutes" INTEGER NOT NULL,
    "photosRequired" BOOLEAN NOT NULL,
    "requiredPhotoKinds" "PhotoKind"[] DEFAULT ARRAY[]::"PhotoKind"[],
    "kindSuggestion" "VisitKind",
    "kindSuggestionReason" "KindSuggestionReason",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitCancellation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "cancelledAt" TIMESTAMPTZ(3) NOT NULL,
    "hoursBeforeWindowStart" DECIMAL(8,2) NOT NULL,
    "policyFeePercent" DECIMAL(5,2) NOT NULL,
    "appliedFeePercent" DECIMAL(5,2) NOT NULL,
    "overrideReason" TEXT,
    "overriddenByUserId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visitKind" "VisitKind" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "checklistTemplateId" TEXT NOT NULL,
    "status" "ChecklistRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChecklistRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRunItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "fileId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChecklistRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitPhoto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "kind" "PhotoKind" NOT NULL,
    "visibility" "PhotoVisibility" NOT NULL DEFAULT 'INTERNAL',
    "capturedAt" TIMESTAMPTZ(3),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "originVisitId" TEXT NOT NULL,
    "revisitVisitId" TEXT,
    "description" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "incurredOn" DATE NOT NULL,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_key_key" ON "Role"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_id_key" ON "Role"("companyId", "id");

-- CreateIndex
CREATE INDEX "RolePermission_companyId_idx" ON "RolePermission"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionKey_key" ON "RolePermission"("roleId", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_companyId_id_key" ON "RolePermission"("companyId", "id");

-- CreateIndex
CREATE INDEX "Membership_companyId_idx" ON "Membership"("companyId");

-- CreateIndex
CREATE INDEX "Membership_roleId_idx" ON "Membership"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_companyId_id_key" ON "Membership"("companyId", "id");

-- CreateIndex
CREATE INDEX "CompanySetting_companyId_idx" ON "CompanySetting"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySetting_companyId_key_key" ON "CompanySetting"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicy_companyId_key" ON "CancellationPolicy"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicy_companyId_id_key" ON "CancellationPolicy"("companyId", "id");

-- CreateIndex
CREATE INDEX "CancellationPolicyTier_companyId_idx" ON "CancellationPolicyTier"("companyId");

-- CreateIndex
CREATE INDEX "CancellationPolicyTier_policyId_idx" ON "CancellationPolicyTier"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicyTier_policyId_sortOrder_key" ON "CancellationPolicyTier"("policyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicyTier_companyId_id_key" ON "CancellationPolicyTier"("companyId", "id");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_entityType_entityId_idx" ON "AuditLog"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "Notification_companyId_userId_readAt_idx" ON "Notification"("companyId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "File_companyId_idx" ON "File"("companyId");

-- CreateIndex
CREATE INDEX "File_uploadedByUserId_idx" ON "File"("uploadedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "File_storageProvider_storageKey_key" ON "File"("storageProvider", "storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "File_companyId_id_key" ON "File"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Client_sourceLeadId_key" ON "Client"("sourceLeadId");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_number_key" ON "Client"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_id_key" ON "Client"("companyId", "id");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_companyId_id_key" ON "Contact"("companyId", "id");

-- CreateIndex
CREATE INDEX "Address_companyId_idx" ON "Address"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_companyId_id_key" ON "Address"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Property_addressId_key" ON "Property"("addressId");

-- CreateIndex
CREATE INDEX "Property_companyId_idx" ON "Property"("companyId");

-- CreateIndex
CREATE INDEX "Property_clientId_idx" ON "Property"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_companyId_id_key" ON "Property"("companyId", "id");

-- CreateIndex
CREATE INDEX "Lead_companyId_status_idx" ON "Lead"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_companyId_number_key" ON "Lead"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_companyId_id_key" ON "Lead"("companyId", "id");

-- CreateIndex
CREATE INDEX "QuoteRequest_companyId_status_idx" ON "QuoteRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "QuoteRequest_leadId_idx" ON "QuoteRequest"("leadId");

-- CreateIndex
CREATE INDEX "QuoteRequest_clientId_idx" ON "QuoteRequest"("clientId");

-- CreateIndex
CREATE INDEX "QuoteRequest_propertyId_idx" ON "QuoteRequest"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequest_companyId_number_key" ON "QuoteRequest"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequest_companyId_id_key" ON "QuoteRequest"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAssessment_quoteRequestId_key" ON "PropertyAssessment"("quoteRequestId");

-- CreateIndex
CREATE INDEX "PropertyAssessment_companyId_scheduledDate_idx" ON "PropertyAssessment"("companyId", "scheduledDate");

-- CreateIndex
CREATE INDEX "PropertyAssessment_workerId_idx" ON "PropertyAssessment"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAssessment_companyId_quoteRequestId_key" ON "PropertyAssessment"("companyId", "quoteRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAssessment_companyId_id_key" ON "PropertyAssessment"("companyId", "id");

-- CreateIndex
CREATE INDEX "Quote_companyId_status_idx" ON "Quote"("companyId", "status");

-- CreateIndex
CREATE INDEX "Quote_quoteRequestId_status_idx" ON "Quote"("quoteRequestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_companyId_number_key" ON "Quote"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_companyId_id_key" ON "Quote"("companyId", "id");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_sortOrder_idx" ON "QuoteLine"("quoteId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuoteLine_companyId_idx" ON "QuoteLine"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteLine_companyId_id_key" ON "QuoteLine"("companyId", "id");

-- CreateIndex
CREATE INDEX "ServiceOffering_companyId_idx" ON "ServiceOffering"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOffering_companyId_name_key" ON "ServiceOffering"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOffering_companyId_id_key" ON "ServiceOffering"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Service_quoteId_key" ON "Service"("quoteId");

-- CreateIndex
CREATE INDEX "Service_companyId_status_idx" ON "Service"("companyId", "status");

-- CreateIndex
CREATE INDEX "Service_clientId_idx" ON "Service"("clientId");

-- CreateIndex
CREATE INDEX "Service_propertyId_idx" ON "Service"("propertyId");

-- CreateIndex
CREATE INDEX "Service_offeringId_idx" ON "Service"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_companyId_number_key" ON "Service"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Service_companyId_id_key" ON "Service"("companyId", "id");

-- CreateIndex
CREATE INDEX "Visit_companyId_scheduledDate_idx" ON "Visit"("companyId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Visit_companyId_status_idx" ON "Visit"("companyId", "status");

-- CreateIndex
CREATE INDEX "Visit_serviceId_scheduledDate_idx" ON "Visit"("serviceId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_companyId_number_key" ON "Visit"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_companyId_id_key" ON "Visit"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "VisitCancellation_visitId_key" ON "VisitCancellation"("visitId");

-- CreateIndex
CREATE INDEX "VisitCancellation_companyId_idx" ON "VisitCancellation"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitCancellation_companyId_visitId_key" ON "VisitCancellation"("companyId", "visitId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitCancellation_companyId_id_key" ON "VisitCancellation"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_userId_key" ON "Worker"("userId");

-- CreateIndex
CREATE INDEX "Worker_companyId_idx" ON "Worker"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_companyId_id_key" ON "Worker"("companyId", "id");

-- CreateIndex
CREATE INDEX "Team_companyId_idx" ON "Team"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_companyId_name_key" ON "Team"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_companyId_id_key" ON "Team"("companyId", "id");

-- CreateIndex
CREATE INDEX "TeamMember_companyId_idx" ON "TeamMember"("companyId");

-- CreateIndex
CREATE INDEX "TeamMember_workerId_idx" ON "TeamMember"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_workerId_key" ON "TeamMember"("teamId", "workerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_companyId_id_key" ON "TeamMember"("companyId", "id");

-- CreateIndex
CREATE INDEX "Assignment_companyId_workerId_idx" ON "Assignment"("companyId", "workerId");

-- CreateIndex
CREATE INDEX "Assignment_visitId_idx" ON "Assignment"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_visitId_workerId_key" ON "Assignment"("visitId", "workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_companyId_id_key" ON "Assignment"("companyId", "id");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_companyId_visitKind_idx" ON "ChecklistTemplate"("companyId", "visitKind");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_companyId_id_key" ON "ChecklistTemplate"("companyId", "id");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_sortOrder_idx" ON "ChecklistTemplateItem"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_companyId_idx" ON "ChecklistTemplateItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateItem_companyId_id_key" ON "ChecklistTemplateItem"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistRun_visitId_key" ON "ChecklistRun"("visitId");

-- CreateIndex
CREATE INDEX "ChecklistRun_companyId_idx" ON "ChecklistRun"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistRun_checklistTemplateId_idx" ON "ChecklistRun"("checklistTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistRun_companyId_visitId_key" ON "ChecklistRun"("companyId", "visitId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistRun_companyId_id_key" ON "ChecklistRun"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistRunItem_fileId_key" ON "ChecklistRunItem"("fileId");

-- CreateIndex
CREATE INDEX "ChecklistRunItem_runId_sortOrder_idx" ON "ChecklistRunItem"("runId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistRunItem_companyId_idx" ON "ChecklistRunItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistRunItem_companyId_id_key" ON "ChecklistRunItem"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "VisitPhoto_fileId_key" ON "VisitPhoto"("fileId");

-- CreateIndex
CREATE INDEX "VisitPhoto_visitId_idx" ON "VisitPhoto"("visitId");

-- CreateIndex
CREATE INDEX "VisitPhoto_companyId_idx" ON "VisitPhoto"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitPhoto_companyId_id_key" ON "VisitPhoto"("companyId", "id");

-- CreateIndex
CREATE INDEX "Incident_visitId_idx" ON "Incident"("visitId");

-- CreateIndex
CREATE INDEX "Incident_companyId_status_idx" ON "Incident"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_companyId_id_key" ON "Incident"("companyId", "id");

-- CreateIndex
CREATE INDEX "IncidentFile_fileId_idx" ON "IncidentFile"("fileId");

-- CreateIndex
CREATE INDEX "IncidentFile_companyId_idx" ON "IncidentFile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentFile_incidentId_fileId_key" ON "IncidentFile"("incidentId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentFile_companyId_id_key" ON "IncidentFile"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_revisitVisitId_key" ON "Claim"("revisitVisitId");

-- CreateIndex
CREATE INDEX "Claim_originVisitId_idx" ON "Claim"("originVisitId");

-- CreateIndex
CREATE INDEX "Claim_companyId_status_idx" ON "Claim"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_companyId_id_key" ON "Claim"("companyId", "id");

-- CreateIndex
CREATE INDEX "Expense_companyId_incurredOn_idx" ON "Expense"("companyId", "incurredOn");

-- CreateIndex
CREATE INDEX "Expense_recordedByUserId_idx" ON "Expense"("recordedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_companyId_number_key" ON "Expense"("companyId", "number");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_companyId_roleId_fkey" FOREIGN KEY ("companyId", "roleId") REFERENCES "Role"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_roleId_fkey" FOREIGN KEY ("companyId", "roleId") REFERENCES "Role"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicy" ADD CONSTRAINT "CancellationPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicyTier" ADD CONSTRAINT "CancellationPolicyTier_companyId_policyId_fkey" FOREIGN KEY ("companyId", "policyId") REFERENCES "CancellationPolicy"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAssessment" ADD CONSTRAINT "PropertyAssessment_companyId_quoteRequestId_fkey" FOREIGN KEY ("companyId", "quoteRequestId") REFERENCES "QuoteRequest"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- AddForeignKey
ALTER TABLE "PropertyAssessment" ADD CONSTRAINT "PropertyAssessment_scheduledByUserId_fkey" FOREIGN KEY ("scheduledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAssessment" ADD CONSTRAINT "PropertyAssessment_waivedByUserId_fkey" FOREIGN KEY ("waivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_companyId_quoteRequestId_fkey" FOREIGN KEY ("companyId", "quoteRequestId") REFERENCES "QuoteRequest"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_companyId_quoteId_fkey" FOREIGN KEY ("companyId", "quoteId") REFERENCES "Quote"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOffering" ADD CONSTRAINT "ServiceOffering_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ServiceOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_companyId_serviceId_fkey" FOREIGN KEY ("companyId", "serviceId") REFERENCES "Service"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitCancellation" ADD CONSTRAINT "VisitCancellation_companyId_visitId_fkey" FOREIGN KEY ("companyId", "visitId") REFERENCES "Visit"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitCancellation" ADD CONSTRAINT "VisitCancellation_overriddenByUserId_fkey" FOREIGN KEY ("overriddenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_companyId_teamId_fkey" FOREIGN KEY ("companyId", "teamId") REFERENCES "Team"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_companyId_visitId_fkey" FOREIGN KEY ("companyId", "visitId") REFERENCES "Visit"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_companyId_templateId_fkey" FOREIGN KEY ("companyId", "templateId") REFERENCES "ChecklistTemplate"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_companyId_visitId_fkey" FOREIGN KEY ("companyId", "visitId") REFERENCES "Visit"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRunItem" ADD CONSTRAINT "ChecklistRunItem_companyId_runId_fkey" FOREIGN KEY ("companyId", "runId") REFERENCES "ChecklistRun"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- AddForeignKey
ALTER TABLE "ChecklistRunItem" ADD CONSTRAINT "ChecklistRunItem_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPhoto" ADD CONSTRAINT "VisitPhoto_companyId_visitId_fkey" FOREIGN KEY ("companyId", "visitId") REFERENCES "Visit"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPhoto" ADD CONSTRAINT "VisitPhoto_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_companyId_visitId_fkey" FOREIGN KEY ("companyId", "visitId") REFERENCES "Visit"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentFile" ADD CONSTRAINT "IncidentFile_companyId_incidentId_fkey" FOREIGN KEY ("companyId", "incidentId") REFERENCES "Incident"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentFile" ADD CONSTRAINT "IncidentFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_companyId_originVisitId_fkey" FOREIGN KEY ("companyId", "originVisitId") REFERENCES "Visit"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_revisitVisitId_fkey" FOREIGN KEY ("revisitVisitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Quote_one_accepted_per_request"
  ON "Quote" ("quoteRequestId")
  WHERE "status" = 'ACCEPTED';

CREATE UNIQUE INDEX "Contact_one_primary_per_client"
  ON "Contact" ("clientId")
  WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "ChecklistTemplate_one_active_per_kind"
  ON "ChecklistTemplate" ("companyId", "visitKind")
  WHERE "isActive" = true;

ALTER TABLE "PropertyAssessment"
ADD CONSTRAINT "PropertyAssessment_worker_company_fkey"
FOREIGN KEY ("companyId", "workerId")
REFERENCES "Worker"("companyId", "id")
ON DELETE SET NULL ("workerId")
ON UPDATE CASCADE;

ALTER TABLE "ChecklistRunItem"
ADD CONSTRAINT "ChecklistRunItem_template_item_company_fkey"
FOREIGN KEY ("companyId", "templateItemId")
REFERENCES "ChecklistTemplateItem"("companyId", "id")
ON DELETE SET NULL ("templateItemId")
ON UPDATE CASCADE;
