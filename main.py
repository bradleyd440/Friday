import speech_recognition as sr
import pyttsx3
import webbrowser
import os
import requests
from datetime import datetime

# Constants and initializations
ASSISTANT_NAME = "friday"
WEATHER_API_KEY = "your_openweather_api_key"  # Replace with your actual API key
WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/weather"

recognizer = sr.Recognizer()
engine = pyttsx3.init()

# Set the assistant's voice to female
voices = engine.getProperty('voices')
for voice in voices:
    if "female" in voice.name.lower():
        engine.setProperty('voice', voice.id)
        break

def speak(text):
    """Make the assistant speak."""
    engine.say(text)
    engine.runAndWait()

def listen():
    """Listen for commands."""
    with sr.Microphone() as source:
        print("Listening...")
        recognizer.adjust_for_ambient_noise(source)
        audio = recognizer.listen(source)
        
        try:
            command = recognizer.recognize_google(audio)
            print(f"You said: {command}")
            return command.lower()
        except sr.UnknownValueError:
            speak("Sorry, I didn't catch that.")
            return ""
        except sr.RequestError:
            speak("Sorry, I am having trouble connecting to the internet.")
            return ""

def handle_command(command):
    """Handle commands based on keywords."""
    if "weather" in command:
        speak("Which city?")
        city = listen()
        if city:
            get_weather(city)
    elif "time" in command:
        now = datetime.now().strftime("%H:%M")
        speak(f"The time is {now}")
    elif "open" in command:
        app_name = command.replace("open", "").strip()
        open_application(app_name)
    elif "search for" in command:
        search_query = command.replace("search for", "").strip()
        search_web(search_query)
    else:
        speak("I'm not sure how to respond to that.")

def open_application(app_name):
    """Open common applications based on keywords."""
    if "notepad" in app_name:
        os.system("notepad")
        speak("Opening Notepad.")
    elif "calculator" in app_name:
        os.system("calc")
        speak("Opening Calculator.")
    else:
        speak("Sorry, I can't open that application right now.")

def get_weather(city):
    """Fetch and speak the weather for a specified city."""
    try:
        params = {'q': city, 'appid': WEATHER_API_KEY, 'units': 'metric'}
        response = requests.get(WEATHER_API_URL, params=params)
        weather_data = response.json()
        
        if weather_data["cod"] != "404":
            main = weather_data["main"]
            temperature = main["temp"]
            description = weather_data["weather"][0]["description"]
            speak(f"The weather in {city} is {description} with a temperature of {temperature} degrees Celsius.")
        else:
            speak("City not found.")
    except Exception as e:
        print(e)
        speak("I couldn't retrieve the weather information.")

def search_web(query):
    """Search the web for a given query."""
    speak(f"Searching the web for {query}")
    webbrowser.open(f"https://www.google.com/search?q={query}")

def main():
    """Main loop to listen for and handle commands."""
    speak("Hello, how can I assist you today?")
    while True:
        command = listen()
        
        # Check if the assistant's name is mentioned
        if ASSISTANT_NAME in command:
            command = command.replace(ASSISTANT_NAME, "").strip()
            handle_command(command)
            
            if "exit" in command:
                speak("Goodbye!")
                break
        else:
            print("Waiting for the wake word.")

if __name__ == "__main__":
    main()