import type { Profile } from "@/lib/types";

export const TRIAL_DAYS = 30;
export const PRICE_CENTS = 1900; // $19/month flat

const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

export type AccessInfo = {
  /** Can create and send quotes. */
  active: boolean;
  subscribed: boolean;
  trialDaysLeft: number;
};

// Soft gate: after the trial, creating/sending quotes requires an active
// subscription. Existing quotes and public client pages are never blocked.
export function accessInfo(profile: Profile): AccessInfo {
  const subscribed = ACTIVE_STATUSES.includes(profile.subscription_status);
  const trialEnd =
    new Date(profile.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const trialDaysLeft = Math.max(
    0,
    Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000))
  );
  return { active: subscribed || trialDaysLeft > 0, subscribed, trialDaysLeft };
}

export const LOCKED_MESSAGE =
  "Your free trial has ended — subscribe to keep creating and sending quotes.";
