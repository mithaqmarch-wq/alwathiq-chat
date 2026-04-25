// ====== إعدادات مشروعك الحقيقية ======
const firebaseConfig = {
  apiKey: "AIzaSyCkfcb4kiGpK_Dc8lJUADrez-S4_ZfiWmo",
  authDomain: "alwathiq-chat.firebaseapp.com",
  projectId: "alwathiq-chat",
  storageBucket: "alwathiq-chat.firebasestorage.app",
  messagingSenderId: "47442938424",
  appId: "1:47442938424:web:b8793e5665f7eb424e34cd",
  measurementId: "G-PR90P7E6TD"
};

// تهيئة فاير بيس
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const database = firebase.database();
const myName = "Mithaq_Admin"; 
const SECRET_PASSCODE = "2026"; 

// === نظام مؤثرات الهاكرز (مخيف وروبوتي) ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
  if(audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type; // 'square' أو 'sawtooth' تعطي صوت كمبيوتر قديم
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime); // خفضت الصوت ليكون مزعج بس غير مؤذي
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
  success: () => { playTone(800, 'square', 0.1); setTimeout(()=>playTone(1200, 'square', 0.1), 100); },
  error: () => { playTone(150, 'sawtooth', 0.3); setTimeout(()=>playTone(100, 'sawtooth', 0.4), 300); },
  send: () => playTone(1500, 'square', 0.05),
  receive: () => playTone(600, 'square', 0.1),
  delete: () => playTone(200, 'sawtooth', 0.2) // صوت الحذف
};

// === واجهة الدخول والإعدادات ===
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

function toggleSettings() {
  const modal = document.getElementById("settings-modal");
  modal.style.display = modal.style.display === "none" ? "block" : "none";
}

// === إرسال البيانات ===
function sendMessage() {
  const inputField = document.getElementById("msg-input");
  const messageText = inputField.value.trim();
  if (messageText !== "") {
    database.ref("messages").push().set({
      sender: myName,
      type: "text",
      content: messageText,
      edited: false,
      timestamp: Date.now()
    });
    inputField.value = "";
  }
}

// === نظام الحذف والتعديل المباشر ===
function deleteMessage(key) {
  if (confirm("> SYSTEM PROMPT: هل تريد إتلاف هذه البيانات من السيرفر نهائياً؟")) {
    database.ref("messages").child(key).remove();
    sounds.delete();
  }
}

function editMessage(key, oldText) {
  const newText = prompt("> OVERRIDE_TEXT: أدخل النص الجديد", oldText);
  if (newText && newText.trim() !== "" && newText !== oldText) {
    database.ref("messages").child(key).update({ 
      content: newText.trim(),
      edited: true 
    });
  }
}

// === الاستماع للرسائل (إضافة، تعديل، حذف) ===
const messagesRef = database.ref("messages");

// 1. عند إضافة رسالة
messagesRef.on("child_added", (snapshot) => {
  const data = snapshot.val();
  const key = snapshot.key;
  const isMe = data.sender === myName;
  
  const msgDiv = document.createElement("div");
  msgDiv.id = "msg-" + key;
  msgDiv.classList.add("message", isMe ? "sent" : "received");
  
  let contentHtml = `<div class="msg-content" id="content-${key}">`;
  
  if (data.type === "text") {
    contentHtml += `> ${data.content} ${data.edited ? '<span style="color:#ffeb3b; font-size:0.7em;">[EDITED]</span>' : ''}`;
  } else if (data.type === "image") {
    contentHtml += `<img src="${data.content}" class="msg-image">`;
  } else if (data.type === "audio") {
    contentHtml += `<audio controls src="${data.content}" class="msg-audio"></audio>`;
  }
  contentHtml += `</div>`;

  // إضافة أزرار التعديل والحذف فقط إذا كانت الرسالة لي
  if (isMe) {
    contentHtml += `
      <div class="msg-actions">
        ${data.type === "text" ? `<span class="btn-edit" onclick="editMessage('${key}', '${data.content}')">[EDIT]</span>` : ''}
        <span class="btn-delete" onclick="deleteMessage('${key}')">[DEL]</span>
      </div>`;
  }

  msgDiv.innerHTML = contentHtml;
  document.getElementById("messages").appendChild(msgDiv);
  document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
  
  if (isMe) sounds.send(); else sounds.receive();
});

// 2. عند حذف رسالة (تختفي من الشاشة فوراً)
messagesRef.on("child_removed", (snapshot) => {
  const el = document.getElementById("msg-" + snapshot.key);
  if (el) el.remove();
});

// 3. عند تعديل رسالة (تتحدث في الشاشة فوراً)
messagesRef.on("child_changed", (snapshot) => {
  const data = snapshot.val();
  const contentEl = document.getElementById("content-" + snapshot.key);
  if (contentEl && data.type === "text") {
    contentEl.innerHTML = `> ${data.content} <span style="color:#ffeb3b; font-size:0.7em;">[EDITED]</span>`;
  }
});


// === نظام تسجيل الصوت والملفات المحدث ===
let isRecording = false;
let mediaRecorder; 
let audioChunks = [];

async function toggleRecording() {
  const micBtn = document.getElementById("mic-btn");
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = e => { 
        if (e.data.size > 0) audioChunks.push(e.data); 
      };
      
      mediaRecorder.onstop = () => {
        // الحل الجذري: نأخذ صيغة الصوت من المتصفح نفسه مهما كان نوعه
        const audioType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: audioType });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (reader.result) {
            database.ref("messages").push().set({
              sender: myName, 
              type: "audio", 
              content: reader.result, 
              timestamp: Date.now()
            });
          }
        };
        // إغلاق المايكروفون بعد التسجيل
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(); 
      isRecording = true; 
      micBtn.classList.add("recording");
    } catch (err) { 
      alert("> ERROR: MICROPHONE ACCESS DENIED."); 
    }
  } else {
    mediaRecorder.stop(); 
    isRecording = false; 
    micBtn.classList.remove("recording");
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
    } else { alert("> ERROR: SYSTEM ONLY ACCEPTS IMAGE PAYLOADS CURRENTLY."); }
  };
  reader.readAsDataURL(file);
  event.target.value = ""; 
}

document.getElementById("msg-input").addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });
document.getElementById("passcode").addEventListener("keypress", e => { if (e.key === "Enter") checkPassword(); });
