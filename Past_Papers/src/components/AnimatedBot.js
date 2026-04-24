// src/components/AnimatedBot.jsx
import React from "react";
import "./chatbot.css";

const AnimatedBot = () => {
  return (
    <div className="animated-bot">
      <div className="bot-head">
        <div className="bot-antenna"></div>
        <div className="bot-face">
          <div className="bot-eye left"></div>
          <div className="bot-eye right"></div>
          <div className="bot-mouth"></div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedBot;