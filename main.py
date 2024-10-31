import os
import openai
import speech_recognition as sr
import pyttsx3
import webbrowser
import requests
from datetime import datetime

# Constants and initializations
ASSISTANT_NAME = "friday"
WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY")  # Retrieve API key from environment
WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/weather"

recognizer = sr.Recognizer()
engine = pyttsx3.init()

# Set the assistant's voice to female
voices = engine.getProperty('voices')
for voice in voices:
    if "female" in voice.name.lower():
        engine.setProperty('voice', voice.id)
        break

class Config:
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")  # Retrieve API key from environment

class Assistant:
    def __init__(self):
        openai.api_key = Config.OPENAI_API_KEY

    def speak(self, text):
        """Make the assistant speak."""
        engine.say(text)
        engine.runAndWait()

    def listen(self):
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
                self.speak("Sorry, I didn't catch that.")
                return ""
            except sr.RequestError:
                self.speak("Sorry, I am having trouble connecting to the internet.")
                return ""

    def handle_command(self, command):
        """Handle commands based on keywords."""
        if "weather" in command:
            self.speak("Which city?")
            city = self.listen()
            if city:
                self.get_weather(city)
        elif "time" in command:
            now = datetime.now().strftime("%H:%M")
            self.speak(f"The time is {now}")
        elif "open" in command:
            app_name = command.replace("open", "").strip()
            self.open_application(app_name)
        elif "search for" in command:
            search_query = command.replace("search for", "").strip()
            self.search_web(search_query)
        else:
            # Use OpenAI to respond to unrecognized commands
            response = self.ask_openai(command)
            if response:
                self.speak(response)

    def open_application(self, app_name):
        """Open common applications based on keywords."""
        if "notepad" in app_name:
            os.system("notepad")
            self.speak("Opening Notepad.")
        elif "calculator" in app_name:
            os.system("calc")
            self.speak("Opening Calculator.")
        else:
            self.speak("Sorry, I can't open that application right now.")

    def get_weather(self, city):
        """Fetch and speak the weather for a specified city."""
        try:
            params = {'q': city, 'appid': WEATHER_API_KEY, 'units': 'metric'}
            response = requests.get(WEATHER_API_URL, params=params)
            weather_data = response.json()

            if weather_data.get("cod") != "404":
                main = weather_data["main"]
                temperature = main["temp"]
                description = weather_data["weather"][0]["description"]
                self.speak(f"The weather in {city} is {description} with a temperature of {temperature} degrees Celsius.")
            else:
                self.speak("City not found.")
        except Exception as e:
            print(e)
            self.speak("I couldn't retrieve the weather information.")

    def search_web(self, query):
        """Search the web for a given query."""
        self.speak(f"Searching the web for {query}")
        webbrowser.open(f"https://www.google.com/search?q={query}")

    def ask_openai(self, question):
        """Ask OpenAI for a response."""
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": question}]
            )
            answer = response.choices[0].message['content'].strip()
            return answer
        except Exception as e:
            self.speak("Sorry, I couldn't fetch an answer.")
            return None

    def main(self):
        """Main loop to listen for and handle commands."""
        self.speak("Hello, how can I assist you today?")
        while True:
            command = self.listen()

            # Check if the assistant's name is mentioned
            if ASSISTANT_NAME in command:
                command = command.replace(ASSISTANT_NAME, "").strip()
                self.handle_command(command)

                if "exit" in command:
                    self.speak("Goodbye!")
                    break
            else:
                print("Waiting for the wake word.")

if __name__ == "__main__":
    assistant = Assistant()
    assistant.main()