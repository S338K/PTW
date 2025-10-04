const express = require("express");
const router = express.Router();
const axios = require("axios");
const user = require("../models/user");

// ✅ Mount new route modules
router.use("/", require("./auth"));     // /register, /login, /logout, /profile, /forgot-password, /reset-password
router.use("/", require("./permit"));   // /permit, /permit/:id, /permit (POST), /permit/:id/status, /permit/:id/pdf

// ===== KEEP SESSION ALIVE =====
router.get("/ping", (req, res) => {
  if (req.session && req.session.userId) {
    req.session.touch(); // refresh expiry
    return res.json({ message: "Session is alive" });
  }
  res.status(401).json({ message: "Session expired" });
});

// ===== WEATHER ROUTE =====
router.get("/weather", async (req, res) => {
  try {
    const city = req.query.city || "Doha";
    const apiKey = process.env.WEATHER_API_KEY;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

    const weatherRes = await axios.get(weatherUrl);
    const w = weatherRes.data;

    const temp = Math.round(w.main.temp);
    const feelsLike = Math.round(w.main.feels_like);
    const humidity = Math.round(w.main.humidity);
    const windSpeed = Math.round(w.wind.speed);
    const visibility = Math.round((w.visibility || 0) / 1000);
    const pressure = w.main.pressure;
    const condition = w.weather[0].description;
    const conditionIcon = `https://openweathermap.org/img/wn/${w.weather[0].icon}@2x.png`;

    const { lat, lon } = w.coord;
    const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const airRes = await axios.get(airUrl);
    const aqi = airRes.data.list[0].main.aqi;
    const aqiStatus = { 1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor" }[aqi] || "Unknown";

    res.json({
      formatted: `${temp}°C | ${condition}`,
      temperature: temp,
      condition,
      detailsLine: `Temperature: ${temp}°C (feels like ${feelsLike}°C) | Weather status: ${condition} | Humidity: ${humidity}% | Visibility: ${visibility} km | Wind Speed: ${windSpeed} m/s | AQI: ${aqi} | Quality: ${aqiStatus}`,
      icons: { condition: conditionIcon }
    });
  } catch (err) {
    console.error("Weather fetch error:", err.response?.data || err.message);
    res.status(500).json({ message: "Unable to fetch weather", error: err.response?.data || err.message });
  }
});

module.exports = router;
