CREATE TYPE "public"."status_source" AS ENUM('manual', 'gmail');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('prospect', 'contacted', 'in-talks', 'committed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."touchpoint_status" AS ENUM('sent', 'replied', 'ghosted', 'in-progress', 'bounced');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"website" text,
	"industry" text,
	"notes" text,
	"logo_url" text,
	"stage" "stage" DEFAULT 'prospect' NOT NULL,
	"created_by" text NOT NULL,
	"owner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" text,
	"linkedin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_member" (
	"mac_user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reassignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_mac_user_id" text NOT NULL,
	"to_mac_user_id" text NOT NULL,
	"companies_moved" integer NOT NULL,
	"touchpoints_moved" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"from_stage" "stage",
	"to_stage" "stage" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "touchpoint_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"touchpoint_id" uuid NOT NULL,
	"status" "touchpoint_status" NOT NULL,
	"note" text,
	"source" "status_source" DEFAULT 'manual' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"by" text
);
--> statement-breakpoint
CREATE TABLE "touchpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"channel" text NOT NULL,
	"subject" text,
	"body_snippet" text,
	"sent_at" timestamp with time zone NOT NULL,
	"next_follow_up_at" timestamp with time zone,
	"owner" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpoint_events" ADD CONSTRAINT "touchpoint_events_touchpoint_id_touchpoints_id_fk" FOREIGN KEY ("touchpoint_id") REFERENCES "public"."touchpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpoints" ADD CONSTRAINT "touchpoints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpoints" ADD CONSTRAINT "touchpoints_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_name_norm_idx" ON "companies" USING btree ("name_normalized");--> statement-breakpoint
CREATE INDEX "tp_events_touchpoint_idx" ON "touchpoint_events" USING btree ("touchpoint_id","at");--> statement-breakpoint
CREATE INDEX "touchpoints_company_idx" ON "touchpoints" USING btree ("company_id");