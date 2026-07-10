CREATE TABLE "gmail_sync_state" (
	"mailbox_key" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"last_history_id" text,
	"last_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
