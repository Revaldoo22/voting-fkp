-- Store voter's own school separately from the participant school they support.
alter table public.profiles
  add column if not exists origin_school_name text,
  add column if not exists voter_status text
    check (
      voter_status is null
      or voter_status in (
        'guru',
        'teman_luar_sekolah',
        'teman_siswa_sekolah'
      )
    );
