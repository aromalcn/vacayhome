-- Create the location_pois table
CREATE TABLE IF NOT EXISTS location_pois (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('attraction', 'restaurant', 'transport', 'event')),
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    info JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES profiles(id),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE location_pois ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view POIs
DROP POLICY IF EXISTS "Allow public read access" ON location_pois;
CREATE POLICY "Allow public read access" ON location_pois FOR SELECT USING (true);

-- Allow authenticated users to insert POIs
DROP POLICY IF EXISTS "Allow authenticated insert" ON location_pois;
CREATE POLICY "Allow authenticated insert" ON location_pois FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Allow owners to manage their own POIs, and admins to manage all
DROP POLICY IF EXISTS "Allow management of owned POIs" ON location_pois;
CREATE POLICY "Allow management of owned POIs" ON location_pois FOR ALL USING (
    auth.uid() = created_by OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Clear existing sample data to avoid duplicates
TRUNCATE TABLE location_pois;

-- Insert sample data for a common location (e.g., Goa area as properties seem to be there)
-- Let's assume a property is at [15.5488, 73.7553] (Calangute, Goa)
INSERT INTO location_pois (name, category, description, latitude, longitude, info) VALUES
('Calangute Beach', 'attraction', 'One of the most popular beaches in Goa.', 15.5443, 73.7553, '{"entry_fee": "Free", "best_time": "Sunset"}'),
('Fort Aguada', 'attraction', 'A well-preserved seventeenth-century Portuguese fort.', 15.4920, 73.7731, '{"entry_fee": "Rs 25"}'),
('Fisherman''s Wharf', 'restaurant', 'Riverside restaurant with excellent seafood.', 15.5601, 73.7542, '{"cuisine": "Goan/Seafood", "rating": 4.5}'),
('Brittos', 'restaurant', 'Famous beach shack in Baga.', 15.5615, 73.7508, '{"cuisine": "Continental/Italian", "rating": 4.2}'),
('Calangute Bus Stand', 'transport', 'Main bus hub for North Goa.', 15.5414, 73.7632, '{"services": ["KTC", "Private Bus"]}'),
('Pilates for Travelers', 'event', 'A wellness event happening this weekend.', 15.5500, 73.7600, '{"date": "2026-02-22", "price": "Free"}'),

-- Insert sample data for Kochi area (matching some existing properties)
('Cherai Beach', 'attraction', 'Beautiful beach near Kochi with golden sands.', 10.1416, 76.1783, '{"type": "Beach", "best_time": "September to March"}'),
('Wonderla Kochi', 'attraction', 'Popular amusement park with many rides.', 10.0348, 76.3533, '{"entry_fee": "Rs 1200"}'),
('Ginger House Museum Restaurant', 'restaurant', 'Unique dining in a museum setting.', 9.9595, 76.2599, '{"cuisine": "Indian/Seafood"}'),
('Kochi Metro Station (Aluva)', 'transport', 'Main transport link for the city.', 10.1090, 76.3496, '{"type": "Metro"}'),
('Kathakali Performance', 'event', 'Traditional dance performance in Fort Kochi.', 9.9678, 76.2427, '{"time": "6:00 PM"}'),

-- Very specific POIs near the user's properties in Aluva/Angamaly area
('Aluva Palace', 'attraction', 'Historical palace of the Travancore Royal family.', 10.1102, 76.3468, '{"type": "Palace"}'),
('Sree Krishna Temple', 'attraction', 'Ancient temple with beautiful architecture.', 10.1150, 76.3500, '{"type": "Temple"}'),
('Paradise Restaurant', 'restaurant', 'Popular local spot for Malabar Biryani.', 10.1120, 76.3550, '{"cuisine": "South Indian"}'),
('Aluva Private Bus Terminal', 'transport', 'Hub for local and long-distance buses.', 10.1080, 76.3520, '{"services": ["KSRTC", "Private"]}'),
('Sunday Market', 'event', 'Weekly local market with fresh produce.', 10.1200, 76.3600, '{"day": "Sunday"}'),

-- Ultra-precise POIs for the Nedumbassery/Angamaly area (matching properties at 10.13, 76.49)
('Cochin International Airport', 'transport', 'The main gateway to Kerala.', 10.1518, 76.3930, '{"type": "Airport"}'),
('Suvarnamukhi River View', 'attraction', 'Scenic view of the Periyar river branch.', 10.1350, 76.4850, '{"type": "Viewpoint"}'),
('Airport Road Grill', 'restaurant', 'Great spot for travelers and locals.', 10.1400, 76.4500, '{"cuisine": "Arabic/Indian"}'),
('Angamaly Railway Station', 'transport', 'Convenient rail access for northern Kochi.', 10.1983, 76.3861, '{"type": "Train Station"}');
