-- DAKAR MOTOS - ATUALIZAÇÃO DA LÓGICA DE PRIORIDADE
-- Execute este arquivo UMA VEZ no Supabase SQL Editor.

create or replace function public.registrar_troca_oleo(p_mecanico text)
returns void language plpgsql security definer as $$
declare
  v_col text;
  v_new integer;
  v_next integer;
begin
  if p_mecanico not in ('GIL','AMAURI','SAMUEL','TIAGUINHO','TIAGO') then raise exception 'Mecânico inválido'; end if;
  v_col := case p_mecanico when 'GIL' then 'gil_count' when 'AMAURI' then 'amauri_count' when 'SAMUEL' then 'samuel_count' when 'TIAGUINHO' then 'tiaguinho_count' else 'tiago_count' end;
  execute format('update public.controle set %I = %I + 1, updated_at=now() where id=1 returning %I',v_col,v_col,v_col) into v_new;
  select x.idx into v_next from (values
    (0,'GIL', (select gil_count from public.controle where id=1), (select gil_available from public.controle where id=1)),
    (1,'AMAURI',(select amauri_count from public.controle where id=1),(select amauri_available from public.controle where id=1)),
    (2,'SAMUEL',(select samuel_count from public.controle where id=1),(select samuel_available from public.controle where id=1)),
    (3,'TIAGUINHO',(select tiaguinho_count from public.controle where id=1),(select tiaguinho_available from public.controle where id=1)),
    (4,'TIAGO',(select tiago_count from public.controle where id=1),(select tiago_available from public.controle where id=1))
  ) as x(idx,nome,quantidade,disponivel) where x.disponivel order by x.quantidade,x.idx limit 1;
  update public.controle set current_index=coalesce(v_next,0),updated_at=now() where id=1;
  insert into public.historico(mecanico,acao,delta) values(p_mecanico,'trocou óleo',1);
end; $$;

create or replace function public.corrigir_troca_oleo(p_mecanico text)
returns void language plpgsql security definer as $$
declare v_col text;
begin
  if p_mecanico not in ('GIL','AMAURI','SAMUEL','TIAGUINHO','TIAGO') then raise exception 'Mecânico inválido'; end if;
  v_col := case p_mecanico when 'GIL' then 'gil_count' when 'AMAURI' then 'amauri_count' when 'SAMUEL' then 'samuel_count' when 'TIAGUINHO' then 'tiaguinho_count' else 'tiago_count' end;
  execute format('update public.controle set %I = %I - 1, updated_at=now() where id=1',v_col,v_col);
  insert into public.historico(mecanico,acao,delta) values(p_mecanico,'correção -1 troca',-1);
end; $$;

grant execute on function public.registrar_troca_oleo(text) to anon, authenticated;
grant execute on function public.corrigir_troca_oleo(text) to anon, authenticated;
