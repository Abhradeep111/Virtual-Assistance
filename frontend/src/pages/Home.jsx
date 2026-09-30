import React, { useContext, useEffect, useRef, useState } from "react";
import { userDataContext } from "../context/UserContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import aiImg from "../assets/ai.gif";
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";

import userImg from "../assets/user.gif";


function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } =
    useContext(userDataContext);
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const voicesRef = useRef([]);
  const [ham, setHam] = useState(false);
  const isRecognizingRef = useRef(false);
  const synth = window.speechSynthesis;
  const assistantAliases = [
    userData?.assistantName,
    "jarvis",
    "jervis",
    "jervish",
    "jervise",
  ]
    .filter(Boolean)
    .map((name) => name.toLowerCase());

  const loadVoices = () => {
    const voices = synth.getVoices();
    if (voices.length) {
      voicesRef.current = voices;
    }
    return voicesRef.current;
  };

  const getAssistantVoice = () => {
    const voices = loadVoices();
    const englishVoices = voices.filter((voice) =>
      voice.lang?.toLowerCase().startsWith("en"),
    );
    const assistantName = userData?.assistantName?.toLowerCase() || "";
    const femaleNames = [
      "sia",
      "shifra",
      "alexa",
      "siri",
      "eva",
      "anna",
      "ruby",
      "maya",
      "luna",
      "zara",
    ];
    const wantsFemaleVoice = femaleNames.some((name) =>
      assistantName.includes(name),
    );
    const femaleKeywords = [
      "female",
      "woman",
      "zira",
      "susan",
      "aria",
      "samantha",
      "victoria",
      "karen",
    ];
    const maleKeywords = [
      "male",
      "man",
      "david",
      "mark",
      "daniel",
      "george",
      "james",
      "alex",
    ];
    const preferredKeywords = wantsFemaleVoice ? femaleKeywords : maleKeywords;

    const preferredVoice = englishVoices.find((voice) =>
      preferredKeywords.some((keyword) =>
        voice.name.toLowerCase().includes(keyword),
      ),
    );

    return preferredVoice || englishVoices[0] || voices[0] || null;
  };

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, {
        withCredentials: true,
      });
      setUserData(null);
      navigate("/signin");
    } catch (error) {
      setUserData(null);
      console.log(error);
    }
  };

  const startRecognition = () => {
    if (!isSpeakingRef.current && !isRecognizingRef.current) {
      try {
        recognitionRef.current?.start();
        console.log("Recognition requested to start");
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          console.error("Start error:", error);
        }
      }
    }
  };

  
  const playSpeech = (utterence) => {
    synth.cancel();
    synth.resume();
    setTimeout(() => {
      synth.speak(utterence);
    }, 100);
  };

  const speak = (text) => {
    const utterence = new SpeechSynthesisUtterance(text);
    utterence.lang = "en-US";
    const assistantVoice = getAssistantVoice();
    if (assistantVoice) {
      utterence.voice = assistantVoice;
    }

    isSpeakingRef.current = true;
    utterence.onstart = () => {
      console.log("Speech reply started");
    };
    utterence.onerror = () => {
      console.warn("Speech reply error");
      isSpeakingRef.current = false;
      setTimeout(() => {
        startRecognition();
      }, 800);
    };
    utterence.onend = () => {
      setAiText("");
      isSpeakingRef.current = false;
      setTimeout(() => {
        startRecognition();
      }, 800);
    };

    playSpeech(utterence);
  };

  const handleCommand = (data) => {
    if (!data?.response) {
      speak("Sorry, I could not get an answer. Please try again.");
      return;
    }

    const { type, userInput, response } = data;
    speak(response);

    if (type === "google-search") {
      const query = encodeURIComponent(userInput);
      window.open(`https://www.google.com/search?q=${query}`, "_blank");
    }
    if (type === "calculator-open") {
      window.open(`https://www.google.com/search?q=calculator`, "_blank");
    }
    if (type === "instagram-open") {
      window.open(`https://www.instagram.com/`, "_blank");
    }
    if (type === "facebook-open") {
      window.open(`https://www.facebook.com/`, "_blank");
    }
    if (type === "weather-show") {
      window.open(`https://www.google.com/search?q=weather`, "_blank");
    }
    if (type === "youtube-search" || type === "youtube-play") {
      const query = encodeURIComponent(userInput);
      window.open(
        `https://www.youtube.com/results?search_query=${query}`,
        "_blank",
      );
    }
  };

  const beginListening = () => {
    if (isSpeakingRef.current || isRecognizingRef.current) return;
    startRecognition();
  };

  useEffect(() => {
    loadVoices();

    const handleVoicesChanged = () => {
      loadVoices();
    };

    synth.addEventListener("voiceschanged", handleVoicesChanged);

    return () => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, []);

  useEffect(() => {
    if (!userData?.name) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition is not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognitionRef.current = recognition;

    let isMounted = true;
    let startTimeout;

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      setListening(false);
      if (isMounted && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isMounted) {
            try {
              recognition.start();
            } catch (error) {
              if (error.name !== "InvalidStateError") console.error(error);
            }
          }
        }, 1000);
      }
    };

    recognition.onerror = (event) => {
      console.warn("Recognition error:", event.error);
      isRecognizingRef.current = false;
      setListening(false);
    };

    recognition.onresult = async (event) => {
      const transcript =
        event.results[event.results.length - 1][0].transcript.trim();
      console.log("Transcript:", transcript);

      if (
        assistantAliases.some((name) => transcript.toLowerCase().includes(name))
      ) {
        setAiText("");
        setUserText(transcript);
        recognition.stop();
        isRecognizingRef.current = false;
        setListening(false);
        const data = await getGeminiResponse(transcript);
        handleCommand(data);
        setAiText(
          data?.response ||
            "Sorry, I could not get an answer. Please try again.",
        );
        setUserText("");
      }
    };

    const greeting = new SpeechSynthesisUtterance(
      `Hello ${userData.name}, what can I help you with?`,
    );
    greeting.lang = "en-US";
    const greetingVoice = getAssistantVoice();
    if (greetingVoice) {
      greeting.voice = greetingVoice;
    }

    isSpeakingRef.current = true;
    greeting.onstart = () => {
      console.log("Greeting started");
    };
    greeting.onend = () => {
      isSpeakingRef.current = false;
      startTimeout = setTimeout(() => {
        if (isMounted) {
          beginListening();
        }
      }, 800);
    };
    greeting.onerror = () => {
      console.warn("Greeting speech error");
      isSpeakingRef.current = false;
      if (isMounted) {
        beginListening();
      }
    };

    playSpeech(greeting);
    startTimeout = setTimeout(() => {
      if (isMounted && !synth.speaking) {
        isSpeakingRef.current = false;
        beginListening();
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(startTimeout);
      synth.cancel();
      recognition.stop();
      setListening(false);
      isRecognizingRef.current = false;
    };
  }, [userData]);

  return (
    <div className="w-full h-[100vh] bg-gradient-to-t from-[black] to-[#02023d] flex justify-center items-center flex-col gap-[15px] overflow-hidden">
      <CgMenuRight
        className="lg:hidden text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]"
        onClick={() => setHam(true)}
      />
      <div
        className={`absolute lg:hidden top-0 w-full h-full bg-[#00000053] backdrop-blur-lg p-[20px] flex flex-col gap-[20px] items-start ${ham ? "translate-x-0" : "translate-x-full"} transition-transform`}
      >
        <RxCross1
          className=" text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]"
          onClick={() => setHam(false)}
        />
        <button
          className="min-w-[150px] h-[60px]  text-black font-semibold   bg-white rounded-full cursor-pointer text-[19px] "
          onClick={handleLogOut}
        >
          Log Out
        </button>
        <button
          className="min-w-[150px] h-[60px]  text-black font-semibold  bg-white  rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] "
          onClick={() => navigate("/customize")}
        >
          Customize your Assistant
        </button>

        <div className="w-full h-[2px] bg-gray-400"></div>
        <h1 className="text-white font-semibold text-[19px]">History</h1>

        <div className="w-full h-[400px] gap-[20px] overflow-y-auto flex flex-col truncate">
          {userData.history?.map((his, index) => (
            <div
              key={`${his}-${index}`}
              className="text-gray-200 text-[18px] w-full h-[30px]"
            >
              {his}
            </div>
          ))}
        </div>
      </div>
      <button
        className="min-w-[150px] h-[60px] mt-[30px] text-black font-semibold absolute hidden lg:block top-[20px] right-[20px]  bg-white rounded-full cursor-pointer text-[19px] "
        onClick={handleLogOut}
      >
        Log Out
      </button>
      <button
        className="min-w-[150px] h-[60px] mt-[30px] text-black font-semibold  bg-white absolute top-[100px] right-[20px] rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] hidden lg:block "
        onClick={() => navigate("/customize")}
      >
        Customize your Assistant
      </button>
      <div className="w-[300px] h-[400px] flex justify-center items-center overflow-hidden rounded-4xl shadow-lg">
        <img
          src={userData?.assistantImage}
          alt=""
          className="h-full object-cover"
        />
      </div>
      <h1 className="text-white text-[18px] font-semibold">
        I'm {userData?.assistantName}
      </h1>
      {!aiText && <img src={userImg} alt="" className="w-[200px]" />}
      {aiText && <img src={aiImg} alt="" className="w-[200px]" />}

      <h1 className="text-white text-[18px] font-semibold text-wrap">
        {userText ? userText : aiText ? aiText : null}
      </h1>
    </div>
  );
}

export default Home;
