"use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthCard() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFeedback({
        kind: "error",
        message: "Enter your email so we can send the sign-in link."
      });
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const redirectTo = `${window.location.origin}/auth/confirm`;
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: redirectTo,
            shouldCreateUser: true
          }
        });

        if (error) {
          setFeedback({
            kind: "error",
            message: error.message
          });
          return;
        }

        setFeedback({
          kind: "success",
          message: `Magic link sent to ${normalizedEmail}. Open it on this device to enter your dashboard.`
        });
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Could not send the sign-in link."
        });
      }
    });
  }

  return (
    <section className="card auth-card">
      <div className="card-header">
        <div>
          <h2>Start your seller account</h2>
          <p>One magic link. No password to remember. Each seller gets a private dashboard and their own 10-URL cap.</p>
        </div>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="label">
          <span>Work email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@shop.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <div className="button-row">
          <button className="button" type="submit" disabled={isPending}>
            {isPending ? "Sending link..." : "Email me a sign-in link"}
          </button>
          <span className="subtle">For public launch, configure Supabase Auth SMTP so any seller can receive sign-in emails.</span>
        </div>
      </form>

      {feedback ? <div className={`flash ${feedback.kind === "error" ? "error" : "success"}`}>{feedback.message}</div> : null}
    </section>
  );
}
