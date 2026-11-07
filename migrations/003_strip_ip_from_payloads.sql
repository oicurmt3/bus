UPDATE bus_ratings
SET payload = payload - 'ipAddress' - 'user_name' - 'user_phone'
WHERE payload ?| ARRAY['ipAddress', 'user_name', 'user_phone'];
