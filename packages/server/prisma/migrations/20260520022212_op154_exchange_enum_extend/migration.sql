-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Exchange" ADD VALUE 'AMEX';
ALTER TYPE "Exchange" ADD VALUE 'OTC';
ALTER TYPE "Exchange" ADD VALUE 'KONEX';
ALTER TYPE "Exchange" ADD VALUE 'TSE_STANDARD';
ALTER TYPE "Exchange" ADD VALUE 'TSE_GROWTH';
