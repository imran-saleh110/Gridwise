CREATE TABLE "health_checks" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detail" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(64) NOT NULL
);
