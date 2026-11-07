-- ArtaHealth · Migration 0029 · Tier musiman Paket Ramadan (Fase 9 · RW-4c)
-- Perluas tabel `subscriptions` (0003) agar mendukung tier 'ramadan' (sekali bayar, ber-valid_until)
-- dan penyedia pembayaran 'xendit' (selain 'midtrans'). TIDAK ada baris baru; RLS tetap:
-- pengguna hanya MEMBACA baris miliknya, penulisan hanya via service_role (webhook / manual).
-- Nama constraint = nama otomatis Postgres untuk CHECK kolom inline di 0003.

alter table subscriptions drop constraint if exists subscriptions_tier_check;
alter table subscriptions add constraint subscriptions_tier_check
  check (tier in ('free', 'pro', 'ramadan'));

alter table subscriptions drop constraint if exists subscriptions_provider_check;
alter table subscriptions add constraint subscriptions_provider_check
  check (provider in ('midtrans', 'xendit', 'manual', 'playstore'));
