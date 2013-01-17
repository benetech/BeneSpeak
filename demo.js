
function speak() {
    document.getElementById('speechDisplay').innerHTML = document.getElementById('speechInput').value;
    var data = BeneSpeak.generateSpeechData(document.getElementById('speechDisplay'));
    chrome.tts.speak(data.utterance, {
    	rate : parseFloat(document.getElementById("speechRate").value),
    	voiceName : document.getElementById("voice").options[document.getElementById("voice").selectedIndex].value,
    	desiredEventTypes : ['word'],
    	onEvent : function(event) { data.handleTtsEvent(event); }
	});
}

function updateSpeechRateDisplay() {
	document.getElementById("speechRateDisplay").innerText = document.getElementById("speechRate").value;
}

function buildVoiceMenu() {
	var menu = document.getElementById("voice");
	chrome.tts.getVoices(
		function(voices) {
			for (var i = 0; i < voices.length; i++) {
				console.log(voices[i]);
				if (voices[i].eventTypes.indexOf("word") > -1) {
					var opt = document.createElement("option");
					opt.value = voices[i].voiceName;
					opt.innerText = voices[i].voiceName;
					menu.appendChild(opt);
				}
			}
		}
	);
}

document.onreadystatechange = function () {
    if (document.readyState == "complete") {
        document.getElementById('speakButton').onclick = speak;
        document.getElementById('stopButton').onclick = function() { BeneSpeak.stop(); };
        document.getElementById('speechRate').onchange = function() { updateSpeechRateDisplay(); };
        document.getElementById('speechRate').value = 1;

        buildVoiceMenu();
    }
}

