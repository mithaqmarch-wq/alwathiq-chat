// ====== ضع إعدادات مشروعك الحقيقية هنا ======
// يجب أن تبدأ بـ AIzaSy...
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const database = firebase.database();
const myName = "Mithaq"; // اسم المستخدم الافتراضي
const SECRET_PASSCODE = "2026"; // رمز الدخول السري

// === نظام الصوت الاحترافي (نظام الآيفون الهادئ) ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSystemTone(freq, duration, vol = 0.02) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine'; // موجة سينية هادئة جداً
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
  success: () => { playSystemTone(1100, 0.1); setTimeout(() => playSystemTone(1500, 0.2), 80); },
  error: () => playSystemTone(200, 0.3),
  send: () => playSystemTone(1200, 0.05, 0.01), // صوت إرسال خفيف جداً
  receive: () => { playSystemTone(1000, 0.08, 0.01); setTimeout(() => playSystemTone(1300, 0.1, 0.01), 60); } // صوت استلام هادئ
};

// === واجهة الدخول ===
function checkPassword() {
  const input = document.getElementById("passcode").value;
  if (input === SECRET_PASSCODE) {
    sounds.success();
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("chat-screen").style.display = "flex";
  } else {
    sounds.error();
    document.getElementById("error-msg").style.display = "block";
  }
}

// === درج الملصقات المطور ===
function toggleStickers() {
  const drawer = document.getElementById("sticker-drawer");
  drawer.classList.toggle("open");
}

function closeStickers() {
  document.getElementById("sticker-drawer").classList.remove("open");
}

function sendSticker(emoji) {
  // إرسال الملصق كنوع خاص
  database.ref("messages").push().set({
    sender: myName,
    type: "sticker",
    content: emoji,
    timestamp: Date.now()
  });
  closeStickers();
}

// === إرسال نص ===
function sendMessage() {
  const inputInputField = document.getElementById("msg-input");
  const messageText = inputInputField.value.trim();
  if (messageText !== "") {
    database.ref("messages").push().set({
      sender: myName,
      type: "text",
      content: messageText,
      timestamp: Date.now()
    });
    inputInputField.value = "";
    // إيقاف مؤشر الكتابة فور الإرسال
    database.ref("typing/" + myName).set(false);
  }
}

// === تنسيق الوقت الفعلي ===
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

// === الاستماع وعرض الرسائل ===
database.ref("messages").on("child_added", (snapshot) => {
  const data = snapshot.val();
  const isMe = data.sender === myName;
  const messagesContainer = document.getElementById("messages");
  const msgDiv = document.createElement("div");
  
  // إذا كان ملصق، نعطيه كلاس خاص بدون خلفية
  if (data.type === "sticker") {
    msgDiv.classList.add("message", "msg-sticker");
    // تعديل التمركز للملصق
    msgDiv.style.alignSelf = isMe ? "flex-end" : "flex-start";
    msgDiv.innerHTML = data.content;
  } else {
    msgDiv.classList.add("message", isMe ? "sent" : "received");
    let contentHtml = "";
    if (data.type === "text") {
      contentHtml = `<p>${data.content}</p>`;
    } else if (data.type === "image") {
      contentHtml = `<img src="${data.content}" class="msg-image">`;
    } else if (data.type === "audio") {
      contentHtml = `<audio controls src="${data.content}" class="msg-audio"></audio>`;
    }
    
    msgDiv.innerHTML = `
      <div class="msg-content">${contentHtml}</div>
      <div class="msg-meta">${formatTime(data.timestamp)}</div>
    `;
  }

  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  if (isMe) sounds.send(); else sounds.receive();
});

// === تسجيل الصوت والملفات الديناميكي ===
let isRecording = false; let mediaRecorder; let audioChunks = [];

async function toggleRecording() {
  const micBtn = document.getElementById("mic-btn");
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: audioType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (reader.result) {
            database.ref("messages").push().set({
              sender: myName, type: "audio", content: reader.result, timestamp: Date.now()
            });
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start(); isRecording = true; micBtn.classList.add("recording");
    } catch (err) { alert("تم رفض الوصول للمايكروفون."); }
  } else {
    mediaRecorder.stop(); isRecording = false; micBtn.classList.remove("recording");
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    if (file.type.startsWith("image/")) {
      database.ref("messages").push().set({
        sender: myName, type: "image", content: e.target.result, timestamp: Date.now()
      });
    } else { alert("عذراً، النظام يدعم الصور حالياً فقط."); }
  };
  reader.readAsDataURL(file);
  event.target.value = ""; 
}

// مؤشر الكتابة واختصارات الكيبورد
let typingTimer; const typingRef = database.ref("typing/" + myName);
document.getElementById("msg-input").addEventListener("input", () => {
  typingRef.set(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => typingRef.set(false), 2000); // يختفي بعد ثانيتين من التوقف
});

database.ref("typing").on("value", (snapshot) => {
  const data = snapshot.val();
  let isSomeoneElseTyping = false;
  if (data) {
    Object.keys(data).forEach(user => {
      if (user !== myName && data[user] === true) isSomeoneElseTyping = true;
    });
  }
  document.getElementById("typing-indicator").style.display = isSomeoneElseTyping ? "block" : "none";
});

document.getElementById("msg-input").addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });
document.getElementById("passcode").addEventListener("keypress", e => { if (e.key === "Enter") checkPassword(); });
function toggleSettings() { const modal = document.getElementById("settings-modal"); modal.style.display = modal.style.display === "none" ? "flex" : "none"; }
function clearLocalChat() { document.getElementById("messages").innerHTML = ''; toggleSettings(); }
