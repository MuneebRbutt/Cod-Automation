let API_KEY = localStorage.getItem('dashboard_api_key');

document.addEventListener('DOMContentLoaded', () => {
    if (!API_KEY) {
        document.getElementById('auth-modal').classList.remove('hidden');
    } else {
        document.getElementById('dashboard').style.display = 'block';
        fetchOrders();
    }
});

function saveApiKey() {
    const input = document.getElementById('api-key-input').value;
    if (input) {
        API_KEY = input;
        localStorage.setItem('dashboard_api_key', API_KEY);
        document.getElementById('auth-modal').classList.add('hidden');
        document.getElementById('dashboard').style.display = 'block';
        fetchOrders();
    }
}

function logout() {
    localStorage.removeItem('dashboard_api_key');
    API_KEY = null;
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('auth-modal').classList.remove('hidden');
    document.getElementById('api-key-input').value = '';
}

async function fetchOrders() {
    const status = document.getElementById('status-filter').value;
    const tbody = document.getElementById('orders-table-body');
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/dashboard/orders?status=${status}`, {
            headers: { 'x-api-key': API_KEY }
        });
        
        if (res.status === 401) {
            logout();
            alert("Invalid API Key");
            return;
        }
        
        if (!res.ok) throw new Error("Failed to fetch orders");
        
        const orders = await res.json();
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No orders found</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td style="font-family: monospace;">${order.order_id || '-'}</td>
                <td>${order.customer_name || 'Unknown'}</td>
                <td>${order.phone_number}</td>
                <td>${order.total_amount ? '$' + order.total_amount : '-'}</td>
                <td><span class="badge ${order.status}">${order.status}</span></td>
                <td>${new Date(order.created_at).toLocaleString()}</td>
            </tr>
        `).join('');
        
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red;">Error loading orders</td></tr>';
    }
}
