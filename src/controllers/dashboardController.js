const supabase = require('../services/supabase');

const getOrders = async (req, res) => {
  const apiKey = req.get('x-api-key');
  const validKey = process.env.DASHBOARD_API_KEY;

  if (!validKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing API key.' });
  }

  const { status } = req.query;
  
  try {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
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
