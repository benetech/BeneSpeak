
function speak() {
    document.getElementById('speechDisplay').innerHTML = document.getElementById('speechInput').value;
    BeneSpeak.speak(document.getElementById('speechDisplay'));
}

document.onreadystatechange = function () {
    if (document.readyState == "complete") {
        document.getElementById('speakButton').onclick = speak;
        document.getElementById('stopButton').onclick = function() { BeneSpeak.stop(); };
    }
}

