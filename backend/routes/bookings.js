import express from 'express';
import { supabase } from '../supabase.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// GET all bookings for the authenticated user (as a tourist)
router.get('/my-bookings', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, properties(*)')
      .eq('tourist_id', req.user.id)
      .order('check_in', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching my bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET all booking requests for the authenticated user (as an owner)
router.get('/requests', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, properties(*), profiles!tourist_id(full_name, email)')
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching booking requests:', error);
    res.status(500).json({ error: 'Failed to fetch booking requests' });
  }
});

// PATCH update booking status
router.patch('/:id/status', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_status } = req.body;
    
    let updates = { status };
    if (payment_status) {
        updates.payment_status = payment_status;
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

export default router;
