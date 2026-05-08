// ====== ضع إعدادات مشروعك الحقيقية هنا ======
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
const myName = "Mithaq"; 
const SECRET_PASSCODE = "2026"; 

// === نظام الصوت الاحترافي ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSystemTone(freq, duration, vol = 0.02) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine'; 
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
  send: () => playSystemTone(1200, 0.05, 0.01), 
  receive: () => { playSystemTone(1000, 0.08, 0.01); setTimeout(() => playSystemTone(1300, 0.1, 0.01), 60); } 
};

// === طلب إذن الإشعارات ===
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
}

// === واجهة الدخول وحفظ الجلسة ===
function showChatScreen() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("chat-screen").style.display = "flex";
  requestNotificationPermission();
  loadMessages(); // تحميل الرسائل بعد الدخول
}

function checkPassword() {
  const input = document.getElementById("passcode").value;
  if (input === SECRET_PASSCODE) {
    sounds.success();
    localStorage.setItem("chat_session", SECRET_PASSCODE);
    showChatScreen();
  } else {
    sounds.error();
    document.getElementById("error-msg").style.display = "block";
  }
}

// التحقق التلقائي عند فتح الموقع
window.onload = () => {
  if (localStorage.getItem("chat_session") === SECRET_PASSCODE) {
    showChatScreen();
  }
};

// === التفاعلات (Reactions) ===
let activeMessageKey = null;

function openReactions(event, key) {
  activeMessageKey = key;
  const modal = document.getElementById("reaction-modal");
  const box = document.getElementById("reaction-box");
  modal.style.display = "block";
  
  // تحديد مكان ظهور القائمة بناءً على مكان الضغطة
  const clickY = event.clientY;
  const clickX = event.clientX;
  box.style.top = Math.max(20, clickY - 60) + "px";
  box.style.left = clickX + "px";
}

function closeReactions() {
  document.getElementById("reaction-modal").style.display = "none";
  activeMessageKey = null;
}

function sendReaction(emoji) {
  if (activeMessageKey) {
    database.ref("messages/" + activeMessageKey + "/reactions/" + myName).set(emoji);
  }
  closeReactions();
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
    database.ref("typing/" + myName).set(false);
  }
}

// === تنسيق الوقت ===
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

// === استرجاع وعرض الرسائل ===
let messagesLoaded = false;
function loadMessages() {
  if (messagesLoaded) return;
  messagesLoaded = true;

  const messagesContainer = document.getElementById("messages");

  // إضافة رسالة جديدة
  database.ref("messages").on("child_added", (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;
    const isMe = data.sender === myName;
    
    const msgDiv = document.createElement("div");
    msgDiv.id = "msg-" + key;
    msgDiv.classList.add("message", isMe ? "sent" : "received");
    
    // عند الضغط على الرسالة تفتح قائمة التفاعلات
    msgDiv.onclick = (e) => openReactions(e, key);

    let contentHtml = "";
    if (data.type === "text") {
      contentHtml = `<p>${data.content}</p>`;
    } else if (data.type === "image") {
      contentHtml = `<img src="${data.content}" class="msg-image">`;
    } else if (data.type === "audio") {
      contentHtml = `<audio controls src="${data.content}" class="msg-audio"></audio>`;
    }
    
    // حاوية التفاعلات
    let reactionsHtml = `<div class="reactions-badge" id="react-${key}" style="display:none;"></div>`;

    msgDiv.innerHTML = `
      <div class="msg-content">${contentHtml}</div>
      <div class="msg-meta">${formatTime(data.timestamp)}</div>
      ${reactionsHtml}
    `;

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // تشغيل الصوت والإشعارات للرسائل الواردة
    if (isMe) {
      sounds.send();
    } else {
      sounds.receive();
      // إرسال إشعار إذا كان المتصفح في الخلفية
      if (document.hidden && Notification.permission === "granted") {
        new Notification("الواثق جات", {
          body: `رسالة جديدة من ${data.sender}`,
          icon: "https://cdn-icons-png.flaticon.com/512/1041/1041916.png" // يمكنك تغيير الأيقونة
        });
      }
    }

    // عرض التفاعلات إن وجدت مسبقاً
    if(data.reactions) updateReactionsUI(key, data.reactions);
  });

  // تحديث الرسالة (للتفاعلات)
  database.ref("messages").on("child_changed", (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;
    if (data.reactions) {
      updateReactionsUI(key, data.reactions);
    }
  });
}

function updateReactionsUI(key, reactionsObj) {
  const badge = document.getElementById("react-" + key);
  if (!badge) return;
  const emojis = Object.values(reactionsObj);
  if (emojis.length > 0) {
    badge.innerHTML = emojis.join("");
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

// === تسجيل الصوت والملفات ===
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
    if(mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    isRecording = false; micBtn.classList.remove("recording");
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
    } else { alert("النظام يدعم الصور حالياً فقط."); }
  };
  reader.readAsDataURL(file);
  event.target.value = ""; 
}

// === مؤشر الكتابة واختصارات ===
let typingTimer; const typingRef = database.ref("typing/" + myName);
document.getElementById("msg-input").addEventListener("input", () => {
  typingRef.set(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => typingRef.set(false), 2000);
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

function toggleSettings() { 
  const modal = document.getElementById("settings-modal"); 
  modal.style.display = modal.style.display === "none" ? "flex" : "none"; 
}

function clearLocalChat() { 
  document.getElementById("messages").innerHTML = '<div class="message received sys-msg"><p>تم مسح العرض المحلي. (الرسائل محفوظة في السيرفر)</p></div>'; 
  toggleSettings(); 
}
