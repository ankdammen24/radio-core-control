
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_schedule_block() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_station() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_account() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_rotation_rule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_streaming_output() FROM PUBLIC, anon, authenticated;
