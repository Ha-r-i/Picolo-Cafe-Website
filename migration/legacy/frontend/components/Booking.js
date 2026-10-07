import React, { useState } from 'react';
import './Booking.css';
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";


const Booking = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    guests: '2',
    specialRequests: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
    '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM',
    '09:00 PM', '09:30 PM', '10:00 PM'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    try {
      await addDoc(collection(db, "reservations"), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        date: formData.date,
        time: formData.time,
        guests: formData.guests,
        specialRequests: formData.specialRequests,
        status: "pending",
        createdAt: serverTimestamp()
      });
  
      console.log("Booking saved to Firebase!");
      setSubmitted(true);
  
      setTimeout(() => {
        setSubmitted(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          date: '',
          time: '',
          guests: '2',
          specialRequests: '',
        });
      }, 5000);
  
    } catch (error) {
      console.error("Error saving booking:", error);
      alert("Failed to submit booking");
    }
  };
  

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="booking-page">
      <div className="booking-hero">
        <div className="container">
          <h1>Reserve a Table</h1>
          <p>Book your table at Piccolo Cafe and enjoy a delightful dining experience</p>
        </div>
      </div>

      <div className="booking-content">
        <div className="container">
          <div className="booking-wrapper">
            <div className="booking-form-container">
              <h2>Make a Reservation</h2>
              {submitted ? (
                <div className="success-message">
                  <div className="success-icon">✓</div>
                  <h3>Reservation Successful!</h3>
                  <p>We've received your booking request. We'll confirm your reservation shortly via email or phone.</p>
                  <p className="booking-details">
                    <strong>Name:</strong> {formData.name}<br />
                    <strong>Date:</strong> {new Date(formData.date).toLocaleDateString('en-IN')}<br />
                    <strong>Time:</strong> {formData.time}<br />
                    <strong>Guests:</strong> {formData.guests}
                  </p>
                </div>
              ) : (
                <form className="booking-form" onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="name">Full Name *</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="phone">Phone Number *</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        placeholder="Enter your phone number"
                        pattern="[0-9]{10}"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="email">Email Address *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="Enter your email address"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="guests">Number of Guests *</label>
                      <select
                        id="guests"
                        name="guests"
                        value={formData.guests}
                        onChange={handleChange}
                        required
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? 'Guest' : 'Guests'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="date">Reservation Date *</label>
                      <input
                        type="date"
                        id="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        required
                        min={getTodayDate()}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="time">Reservation Time *</label>
                      <select
                        id="time"
                        name="time"
                        value={formData.time}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select a time</option>
                        {timeSlots.map(slot => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="specialRequests">Special Requests</label>
                    <textarea
                      id="specialRequests"
                      name="specialRequests"
                      value={formData.specialRequests}
                      onChange={handleChange}
                      placeholder="Any dietary restrictions, allergies, or special occasions? Let us know!"
                      rows="4"
                    />
                  </div>

                  <button type="submit" className="submit-btn">
                    Confirm Reservation
                  </button>
                </form>
              )}
            </div>

            <div className="booking-info">
              <div className="info-card">
                <div className="info-icon">📍</div>
                <h3>Location</h3>
                <p>Piccolo Cafe</p>
                <p>Indore, Madhya Pradesh</p>
              </div>

              <div className="info-card">
                <div className="info-icon">🕒</div>
                <h3>Opening Hours</h3>
                <p><strong>Monday - Sunday:</strong></p>
                <p>9:00 AM - 10:00 PM</p>
              </div>

              <div className="info-card">
                <div className="info-icon">📞</div>
                <h3>Contact Us</h3>
                <p>Phone: +91 XXXXX XXXXX</p>
                <p>Email: info@piccolocafe.com</p>
              </div>

              <div className="info-card">
                <div className="info-icon">💡</div>
                <h3>Reservation Tips</h3>
                <ul>
                  <li>Book at least 2 hours in advance</li>
                  <li>We hold tables for 15 minutes past reservation time</li>
                  <li>Large groups (8+) please call ahead</li>
                  <li>Cancellations must be made 2 hours before</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;

