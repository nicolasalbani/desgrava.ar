"use client";

import { PASSWORD_RULES, checkPasswordRules } from "@/lib/validators/password";
import { Check, Circle } from "lucide-react";

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const results = checkPasswordRules(password);

  if (!password) return null;

  return (
    <ul className="space-y-1 pt-1">
      {PASSWORD_RULES.map((rule) => {
        const passed = results[rule.key];
        return (
          <li key={rule.key} className="flex items-center gap-1.5 text-xs">
            {passed ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Circle className="text-muted-foreground/40 h-3 w-3" />
            )}
            <span
              className={
                passed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              }
            >
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
