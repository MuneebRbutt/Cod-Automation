const supabase = require('../services/supabase');

const checkHealth = (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running healthily!' });
};

const testDatabase = async (req, res) => {
  try {
    // Attempt to query the 'orders' table
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to query database. Check table name and permissions.',
        details: error.message
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Successfully connected to database!',
      data: data
    });
  } catch (err) {
    console.error('Database connection exception:', err);
    res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred while connecting to the database.',
      details: err.message
    });
  }
};

module.exports = {
  checkHealth,
  testDatabase
};
