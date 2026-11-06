const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📌 ជួសជុលប្រព័ន្ធស្វែងរកផ្លូវថត public ស្វ័យប្រវត្តិ (ទោះបីជា Run ពីទីតាំងណាក៏ដើរដែរ)
let publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(path.join(publicPath, 'login.html'))) {
    publicPath = path.join(__dirname, 'poll-app', 'public');
}
if (!fs.existsSync(path.join(publicPath, 'login.html'))) {
    publicPath = path.join(__dirname, '..', 'public');
}
app.use(express.static(publicPath));

app.use(session({
    secret: 'minimal-secret-key-2026',
    resave: false,
    saveUninitialized: true
}));

// ប្រព័ន្ធបែងចែក Ranking ផ្អែកលើចំនួន Credit
function getRank(credits) {
    if (credits >= 50) return '🥇 Platinum';
    if (credits >= 30) return '🥈 Gold';
    if (credits >= 10) return '🥉 Bronze';
    return '🌱 Newbie';
}

// គណនីគំរូក្នុងប្រព័ន្ធ
let users = [
    { username: 'admin', password: '123', role: 'admin' },
    { username: 'user01', password: '123', role: 'member', credits: 0, votedPolls: [] },
    { username: 'សមាជិកគំរូ A', password: '123', role: 'member', credits: 40, votedPolls: [] },
    { username: 'សមាជិកគំរូ B', password: '123', role: 'member', credits: 20, votedPolls: [] }
];

// បញ្ជី Poll ទាំង ៦
let polls = [
    { id: 1, question: "តើអ្នកចូលចិត្តកីឡាណាជាងគេ?", options: ["បាល់ទាត់", "បាល់បោះ", "វាយកូនឃ្លីលើតុ"], votes: { "បាល់ទាត់": 0, "បាល់បោះ": 0, "វាយកូនឃ្លីលើតុ": 0 }, creditReward: 10 },
    { id: 2, question: "តើអ្នកចូលចិត្តបរិភោគអាហារប្រភេទណាជាងគេ?", options: ["អាហារប៊ូហ្វេ", "អាហារកម្មង់"], votes: { "អាហារប៊ូហ្វេ": 0, "អាហារកម្មង់": 0 }, creditReward: 10 },
    { id: 3, question: "តើអ្នកចង់ទៅដើរលេងនៅខេត្តណាជាងគេ?", options: ["សៀមរាប", "ព្រះសីហនុ", "កំពត"], votes: { "សៀមរាប": 0, "ព្រះសីហនុ": 0, "កំពត": 0 }, creditReward: 10 },
    { id: 4, question: "តើអ្នកប្រើប្រាស់ប្រព័ន្ធប្រតិបត្តិការអ្វី?", options: ["Windows", "macOS", "Linux"], votes: { "Windows": 0, "macOS": 0, "Linux": 0 }, creditReward: 10 },
    { id: 5, question: "តើអ្នកចំណាយពេលប៉ុន្មានម៉ោងលើអ៊ីនធឺណិតក្នុងមួយថ្ងៃ?", options: ["តិចជាង២ម៉ោង", "ពី២ទៅ៥ម៉ោង", "ច្រើនជាង៥ម៉ោង"], votes: { "តិចជាង២ម៉ោង": 0, "ពី២ទៅ៥ម៉ោង": 0, "ច្រើនជាង៥ម៉ោង": 0 }, creditReward: 10 },
    { id: 6, question: "តើអ្នកយល់យ៉ាងណាដែរចំពោះគេហទំព័រនេះ?", options: ["ល្អណាស់", "ល្អ", "គួរសម", "ត្រូវកែលម្អ"], votes: { "ល្អណាស់": 0, "ល្អ": 0, "គួរសម": 0, "ត្រូវកែលម្អ": 0 }, creditReward: 10 }
];

let withdrawRequests = [];

// API - Login 
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = { username: user.username, role: user.role }; 
        res.json({ success: true, role: user.role });
    } else {
        res.json({ success: false, message: "ឈ្មោះ ឬលេខសម្ងាត់មិនត្រឹមត្រូវទេ!" });
    }
});

// API - ពិនិត្យមើល User បច្ចុប្បន្ន
app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        const user = users.find(u => u.username === req.session.user.username);
        if (user && user.role === 'member') {
            user.rank = getRank(user.credits);
        }
        res.json({ loggedIn: true, user: user || req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// API - សម្រាប់ការបោះឆ្នោត
app.post('/api/polls/vote', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    
    const pollId = parseInt(req.body.pollId);
    const optionText = req.body.optionText;
    
    const user = users.find(u => u.username === req.session.user.username);
    
    if (user.votedPolls.includes(pollId)) {
        return res.json({ success: false, message: "អ្នកបានបោះឆ្នោតលើប្រធានបទនេះរួចហើយ!" });
    }

    const poll = polls.find(p => p.id === pollId);
    if (poll && poll.votes && poll.votes[optionText] !== undefined) {
        poll.votes[optionText] += 1;
        user.credits += poll.creditReward;
        user.votedPolls.push(pollId);
        res.json({ success: true, newCredits: user.credits });
    } else {
        res.json({ success: false, message: "ទិន្នន័យមិនត្រឹមត្រូវ!" });
    }
});

// API - ទាញយក Polls ទាំងអស់
app.get('/api/polls', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    res.json(polls);
});

// API - សម្រាប់ការដកប្រាក់
app.post('/api/withdraw', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { amount, bankName, accountNumber } = req.body;
    const user = users.find(u => u.username === req.session.user.username);

    if (user.credits < amount || amount <= 0) {
        return res.json({ success: false, message: "Credit មិនគ្រប់គ្រាន់ ឬមិនត្រឹមត្រូវ!" });
    }

    if (!bankName || !accountNumber) {
        return res.json({ success: false, message: "សូមជ្រើសរើសធនាគារ និងបំពេញលេខគណនីឱ្យបានត្រឹមត្រូវ!" });
    }

    user.credits -= amount;
    withdrawRequests.push({
        id: Date.now(),
        username: user.username,
        amount: amount,
        bankName: bankName,
        accountNumber: accountNumber,
        status: 'Pending'
    });
    res.json({ success: true, newCredits: user.credits });
});

// ================= ADMIN APIs =================
app.get('/api/admin/withdraws', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden" });
    }
    res.json(withdrawRequests);
});

app.post('/api/admin/withdraw/action', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden" });
    }
    const { requestId, action } = req.body;
    const reqIndex = withdrawRequests.findIndex(r => r.id === requestId);
    
    if (reqIndex !== -1) {
        if (action === 'Reject') {
            const user = users.find(u => u.username === withdrawRequests[reqIndex].username);
            if (user) user.credits += withdrawRequests[reqIndex].amount;
        }
        withdrawRequests[reqIndex].status = (action === 'Approve') ? 'Approved' : 'Rejected';
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "រកមិនឃើញសំណើនេះទេ" });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.listen(3000, () => console.log('Membership Poll Credit running at http://localhost:3000'));
