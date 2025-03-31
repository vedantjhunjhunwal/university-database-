const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const oracledb = require('oracledb');

const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
// Oracle XE 11.2 configuration (minimal change)
try {
    oracledb.initOracleClient({
      libDir: 'C:\\oraclexe\\app\\oracle\\product\\11.2.0\\server\\bin' // Path to your Oracle XE binaries
    });
  } catch (err) {
    console.error('Oracle client initialization error:', err);
    process.exit(1);
  }
const dbConfig = {
    user: 'system', // Default admin user for XE
    password: '$Vedant08$', // Password you set during XE installation
    connectString: 'localhost:1521/XE' // Only changed to 'XE' instead of 'ORCL'
};
const devCors = {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  };
  const prodCors = {
    origin: 'https://your-frontend.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 200 // For legacy browser support
  };
  
// Middleware (unchanged)
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize (only changed the table creation error handling)
async function initialize() {
    try {
        const connection = await oracledb.getConnection(dbConfig);
        console.log('Connected to Oracle XE database');

        // Only changed to use Oracle's error code 955 for existing table
        const createTableQuery = `
        CREATE TABLE students123 (
            rollNumber VARCHAR2(50) PRIMARY KEY,
            name VARCHAR2(100) NOT NULL,
            department VARCHAR2(100) NOT NULL,
            universityName VARCHAR2(100) NOT NULL
        )`;

        try {
            await connection.execute(createTableQuery);
            console.log('Table students123 is ready');
        } catch (err) {
            if (err.errorNum === 955) { // ORA-00955 for Oracle XE
                console.log('Table students123 already exists');
            } else {
                console.error('Error creating table:', err);
            }
        }

        await connection.close();
    } catch (err) {
        console.error('Error connecting to Oracle XE database:', err);
    }
}

initialize();

// All your original routes remain exactly the same
// (No changes needed to GET, POST, PUT, DELETE endpoints)

// Get all students (unchanged)
app.get('/api/students', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute('SELECT * FROM students123');
        res.json({ success: true, students: result.rows });
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ success: false, message: 'Error fetching students' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Get student by roll number (unchanged)
app.get('/api/students/:rollNumber', async (req, res) => {
    const rollNumber = req.params.rollNumber;
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            'SELECT * FROM students123 WHERE rollNumber = :rollNumber',
            [rollNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        res.json({ success: true, student: result.rows[0] });
    } catch (err) {
        console.error('Error fetching student:', err);
        res.status(500).json({ success: false, message: 'Error fetching student' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Add new student (unchanged)
app.post('/api/students', async (req, res) => {
    const { rollNumber, name, department, universityName } = req.body;

    if (!rollNumber || !name || !department || !universityName) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `INSERT INTO students123 (rollNumber, name, department, universityName)
             VALUES (:rollNumber, :name, :department, :universityName)`,
            { rollNumber, name, department, universityName },
            { autoCommit: true }
        );

        res.status(201).json({ success: true, message: 'Student added successfully' });
    } catch (err) {
        if (err.errorNum === 1) { // ORA-00001 works the same in XE
            return res.status(400).json({ success: false, message: 'Roll number already exists' });
        }
        console.error('Error adding student:', err);
        res.status(500).json({ success: false, message: 'Error adding student' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Update student (unchanged)
app.put('/api/students/:rollNumber', async (req, res) => {
    const rollNumber = req.params.rollNumber;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No updates provided' });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        const setValues = [];
        const params = { rollNumber };

        if (updates.name) {
            setValues.push('name = :name');
            params.name = updates.name;
        }

        if (updates.department) {
            setValues.push('department = :department');
            params.department = updates.department;
        }

        if (updates.universityName) {
            setValues.push('universityName = :universityName');
            params.universityName = updates.universityName;
        }

        if (setValues.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        const query = `UPDATE students123 SET ${setValues.join(', ')} WHERE rollNumber = :rollNumber`;

        const result = await connection.execute(query, params, { autoCommit: true });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        res.json({ success: true, message: 'Student updated successfully' });
    } catch (err) {
        console.error('Error updating student:', err);
        res.status(500).json({ success: false, message: 'Error updating student' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Delete student (unchanged)
app.delete('/api/students/:rollNumber', async (req, res) => {
    const rollNumber = req.params.rollNumber;
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            'DELETE FROM students123 WHERE rollNumber = :rollNumber',
            [rollNumber],
            { autoCommit: true }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        res.json({ success: true, message: 'Student deleted successfully' });
    } catch (err) {
        console.error('Error deleting student:', err);
        res.status(500).json({ success: false, message: 'Error deleting student' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Serve the HTML file (unchanged)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server (unchanged)
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Using Oracle Database 11g XE');
});
app.use(cors(process.env.NODE_ENV === 'production' ? prodCors : devCors));