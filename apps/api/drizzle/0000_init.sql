CREATE TABLE "counter_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"presence_code" text,
	"last_result" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"purchases" integer DEFAULT 0 NOT NULL,
	"spend" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"reward_id" uuid,
	"reminded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger_events" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"subject_id" uuid,
	"merchant_id" uuid,
	"payload" jsonb NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"chain_status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"block_number" bigint,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "ledger_events_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "merchant_members" (
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_members_merchant_id_user_id_pk" PRIMARY KEY("merchant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"phone" text,
	"gstin" text,
	"pan" text,
	"upi_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"frozen" boolean DEFAULT false NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_renews_at" timestamp with time zone,
	"available" bigint DEFAULT 0 NOT NULL,
	"committed" bigint DEFAULT 0 NOT NULL,
	"owed" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"min_purchases" integer NOT NULL,
	"min_total_spend" bigint DEFAULT 0 NOT NULL,
	"min_purchase_amount" bigint DEFAULT 0 NOT NULL,
	"window_days" integer NOT NULL,
	"reward_kind" text NOT NULL,
	"reward_value" bigint DEFAULT 0 NOT NULL,
	"percent_bps" integer DEFAULT 0 NOT NULL,
	"reward_validity_days" integer NOT NULL,
	"max_enrolments" integer NOT NULL,
	"per_customer_limit" integer DEFAULT 1 NOT NULL,
	"fee_bps" integer DEFAULT 0 NOT NULL,
	"terms_hash" text,
	"enrolled" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"provider" text NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"status" text DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"upi_id" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pool_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"from_bucket" text,
	"to_bucket" text,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presence_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"voided" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reward_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"bill_amount" bigint DEFAULT 0 NOT NULL,
	"used" bigint DEFAULT 0 NOT NULL,
	"fee" bigint DEFAULT 0 NOT NULL,
	"returned" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"percent_bps" integer DEFAULT 0 NOT NULL,
	"fee_bps" integer NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"remaining" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"reminded_days" integer
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"customer_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_customer_ref_unique" UNIQUE("customer_ref")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"offer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "waitlist_offer_id_user_id_pk" PRIMARY KEY("offer_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "counter_sessions" ADD CONSTRAINT "counter_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_sessions" ADD CONSTRAINT "counter_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_sessions" ADD CONSTRAINT "counter_sessions_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_movements" ADD CONSTRAINT "pool_movements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_codes" ADD CONSTRAINT "presence_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_enrolment_id_enrolments_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_enrolment_id_enrolments_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrol_user_idx" ON "enrolments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "enrol_offer_idx" ON "enrolments" USING btree ("offer_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "enrol_one_active" ON "enrolments" USING btree ("offer_id","user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "ledger_chain_idx" ON "ledger_events" USING btree ("chain_status","seq");--> statement-breakpoint
CREATE INDEX "ledger_subject_idx" ON "ledger_events" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "ledger_merchant_idx" ON "ledger_events" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "offers_merchant_idx" ON "offers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "offers_status_idx" ON "offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "pool_mov_merchant_idx" ON "pool_movements" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "purchases_enrol_idx" ON "purchases" USING btree ("enrolment_id");--> statement-breakpoint
CREATE INDEX "purchases_visit_idx" ON "purchases" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "rewards_user_idx" ON "rewards" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "rewards_merchant_idx" ON "rewards" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "visits_merchant_idx" ON "visits" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "visits_user_idx" ON "visits" USING btree ("user_id");