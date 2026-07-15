const supabase = require('../services/supabase');

const getOrders = async (req, res) => {
  const apiKey = req.get('x-api-key');
  const validKey = process.env.DASHBOARD_API_KEY;

  if (!validKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing API key.' });
  }

  const { status, sort, business_id } = req.query;
  
  try {
    const isAscending = sort === 'asc';
    let query = supabase.from('orders').select('*').order('created_at', { ascending: isAscending });
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (business_id) {
      query = query.eq('business_id', business_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json(data);
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getOrders };
