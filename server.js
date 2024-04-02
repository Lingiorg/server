const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./translators.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the translators database.');
  });
  

const getTranslators = (cities, languages, regions, nationalities) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM translators WHERE 1=1`;
    let params = [];

    if (languages.length > 0) {
      sql += ` AND (`;
      languages.forEach((lang, index) => {
        sql += ` Language LIKE ?`;
        params.push(`%${lang}%`);
        if (index < languages.length - 1) sql += ` OR`;
      });
      sql += `)`;
    }

    if (regions.length > 0) {
      sql += ` AND governorate IN (${regions.map(() => '?').join(',')})`;
      params = params.concat(regions);
    }

    if (cities && cities.length > 0) {
      sql += ` AND (`;
      cities.forEach((city, index) => {
        sql += ` address LIKE ?`;
        params.push(`%${city}%`);
        if (index < cities.length - 1) sql += ` OR`;
      });
      sql += `)`;
    }

    if (nationalities.length > 0) {
      sql += ` AND (`;
      nationalities.forEach((nat, index) => {
        sql += ` citizens LIKE ?`;
        params.push(`%${nat}%`);
        if (index < nationalities.length - 1) sql += ` OR`;
      });
      sql += `)`;
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          count: rows.length,
          list: rows
        });
      }
    });
  });
};


  
  
  
app.post('/translators/submit-feedback/:translator_id', (req, res) => {
  const { translator_id } = req.params;
  console.log( translator_id );
  const { feedback, rating } = req.body;

  const timestamp = new Date().toISOString(); // Для сохранения времени создания отзыва

  const sqlInsert = `INSERT INTO feedback (translator_id, feedback, rating, timestamp) VALUES (?, ?, ?, ?)`;
  db.run(sqlInsert, [translator_id, feedback, rating, timestamp], function(err) {
    if (err) {
      console.error('Ошибка при добавлении отзыва:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json({ message: 'Feedback added successfully', feedback_id: this.lastID });
  });
});

app.get('/feedback/data/:translator_id', (req, res) => {
  console.log('Запрос к /feedback/count');
  const { translator_id } = req.params;
  const sql = `SELECT COUNT(*) AS feedbackCount, AVG(rating) AS averageRating FROM feedback WHERE translator_id = ?`;

  db.get(sql, [translator_id], (err, row) => {
    if (err) {
      console.error("ERR: " + err.message);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    console.log("ROW IS :", row);

    // Если row.averageRating не существует или равно null, устанавливаем его равным 5
    const averageRating = row.averageRating !== undefined && row.averageRating !== null ? Math.round(row.averageRating) : 5;

    res.json({
      translator_id: translator_id,
      feedbackCount: row.feedbackCount,
      averageRating: averageRating
    });
  });
});


app.get('/translators/search', async (req, res) => {
  const { city, region, language, translationType } = req.query;

  let sql = `SELECT * FROM translators WHERE 1=1`;
  let params = [];

  // Добавляем условия в SQL-запрос на основе параметров запроса
  if (city) {
    sql += ` AND address LIKE ?`;
    params.push(`%${city}%`);
  }
  if (region) {
    sql += ` AND governorate LIKE ?`;
    params.push(`%${region}%`);
  }
  if (language) {
    sql += ` AND languages LIKE ?`; // Предполагаем, что в таблице есть колонка languages
    params.push(`%${language}%`);
  }
  if (translationType) {
    sql += ` AND languages LIKE ?`; // Предполагаем, что в таблице есть колонка translationType
    params.push(`%${translationType}%`);
  }

  // Выполняем SQL-запрос
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Ошибка при выполнении запроса к базе данных:', err.message);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.json({
      translators: rows,
      count: rows.length,
    });
  });
});


app.get('/feedback/:translator_id', (req, res) => {
  const { translator_id } = req.params;
  const sql = `SELECT * FROM feedback WHERE translator_id = ?`;
  db.all(sql, [translator_id], (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    if (rows.length > 0) {
      res.json(rows);
    } else {
      res.status(404).json({ error: 'Feedback not found' });
    }
  });
});



app.get('/translators/profile/:translator_id', async (req, res) => {
    const translator_id = req.params.translator_id;
  
    try {
      const sql = `SELECT * FROM translators WHERE translator_id = ?`;
      db.get(sql, [translator_id], (err, row) => {
        if (err) {
          console.error(err.message);
          res.status(500).json({ error: 'Internal Server Error' });
        } else if (row) {
            console.log("ROW IS" + row);
          res.json(row);
        } else {
          res.status(404).json({ error: 'Translator not found' });
        }   
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  

const getArrayFromQueryParam = (queryParam) => {
    if (!queryParam) return [];
    if (Array.isArray(queryParam)) return queryParam;
    return queryParam.split(',').map(item => item.trim());
  };
  

  app.post('/translators/update-reviews/:translator_id', (req, res) => {
    const translator_id = req.params.translator_id;
  
    const sqlUpdate = `UPDATE translators SET reviews = reviews + 1 WHERE translator_id = ?`;
  
db.run(sqlUpdate, [translator_id], function(err) {
  if (err) {
    console.error(`Ошибка при обновлении: ${sqlUpdate} с ID переводчика ${translator_id}. Ошибка: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
    return;
  }
  res.json({ message: 'Review count updated successfully', changes: this.changes });
});
  });

app.get('/translators/:cityName?', async (req, res) => {
  const cityName = req.params.cityName && req.params.cityName !== 'all' ? req.params.cityName.split(',') : [];
  const languages = getArrayFromQueryParam(req.query.languages);
  const regions = getArrayFromQueryParam(req.query.regions);
  const nationalities = getArrayFromQueryParam(req.query.nationalities);

  try {
    const result = await getTranslators(cityName, languages, regions, nationalities);
    res.json({
      city: cityName || "Wszyscy",
      translators_count: result.count,
      translators: result.list
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
