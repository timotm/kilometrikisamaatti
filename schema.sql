drop table if exists login;

create table login (
       id bigserial primary key,
       kk_login varchar(50) unique not null,
       kk_passwd varchar(50) not null,
       moves_accesstoken text,
       strava_accesstoken text,
       strava_refreshtoken text
);
