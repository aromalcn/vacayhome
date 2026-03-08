import express from 'express';
import { supabase } from '../supabase.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// GET all properties
router.get('/', async (req, res) => {
  try {
    const { data: propsData, error: propsError } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (propsError) throw propsError;

    // Fetch Owners
    const ownerIds = [...new Set(propsData.map(p => p.owner_id).filter(Boolean))];
    let ownersMap = {};
    
    if (ownerIds.length > 0) {
      const { data: ownersData, error: ownersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_verified')
        .in('id', ownerIds);
      
      if (!ownersError && ownersData) {
        ownersData.forEach(o => ownersMap[o.id] = o);
      }
    }

    const enrichedProps = propsData.map(p => ({
      ...p,
      owner_name: ownersMap[p.owner_id]?.full_name || 'Unknown',
      owner_email: ownersMap[p.owner_id]?.email || '',
      is_owner_verified: ownersMap[p.owner_id]?.is_verified
    }));

    res.json(enrichedProps);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// GET single property by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (property.owner_id) {
       const { data: ownerData } = await supabase
         .from('profiles')
         .select('id, full_name, email, avatar_url')
         .eq('id', property.owner_id)
         .single();
       if (ownerData) {
         property.owner = ownerData;
       }
    }

    res.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// PATCH update property status (protected, usually admin)
router.patch('/:id/status', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const { data, error } = await supabase
      .from('properties')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating property status:', error);
    res.status(500).json({ error: 'Failed to update property status' });
  }
});

export default router;
