/**
 * /admin/login — small wrapper that redirects to the existing /auth flow.
 * The existing auth page already handles sign-in for admins.
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/login")({ component: AdminLogin });

function AdminLogin() {
  return <Navigate to="/auth" replace />;
}
