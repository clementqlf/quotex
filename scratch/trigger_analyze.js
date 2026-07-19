const trigger = async () => {
  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldXJiemtrZnhyanpqeWt0aHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTc1NzcsImV4cCI6MjA5MzI5MzU3N30.vwvQQCjuIfCwcJ1vyrPt1bx09_oouKATvNQnO4axIvQ';
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/quotes/366/analyze', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
};
trigger();
