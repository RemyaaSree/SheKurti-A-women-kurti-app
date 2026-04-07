import React, { useEffect, useState } from 'react';
import { getBlog } from '../services/api';
import '../styles/Pages.css';

interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  image: string;
  date: string;
  category: string;
  author: string;
  content: string;
}

const fallbackBlogPosts: BlogPost[] = [
  {
    id: 1,
    title: 'The Art of Traditional Indian Embroidery',
    excerpt: 'Discover the intricate patterns and techniques that make Indian embroidery world-famous.',
    image: 'http://daloreindia.com/cdn/shop/files/IMG_8221.jpg?v=1730189514&width=1024',
    date: '2024-01-20',
    category: 'Craftsmanship',
    author: 'Priya Sharma',
    content: `Indian embroidery is a beautiful art form that has been passed down through generations. Each stitch tells a story,
    and each pattern represents the culture and traditions of different regions. From the delicate zardozi work of Lucknow to
    the vibrant phulkari of Punjab, Indian embroidery is a testament to the skill and dedication of our artisans.

    The techniques used in traditional embroidery require years of training and practice. Every piece is unique, crafted with
    care and attention to detail. When you wear a kurti with traditional embroidery, you are wearing a piece of art that
    celebrates our rich heritage.`,
  },
  {
    id: 2,
    title: 'Sustainable Fashion: Why We Choose Eco-Friendly',
    excerpt: 'Learn about our commitment to sustainable practices and ethical fashion.',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTPiu6zG8OMklIwEYnCULpnLxVbTiEbMmPkVQ&s',
    date: '2024-01-15',
    category: 'Sustainability',
    author: 'Amit Kumar',
    content: `At SheKurti, sustainability is at the heart of everything we do. We believe that beautiful fashion does not have to
    come at the cost of our planet. That is why we have made conscious choices in every aspect of our business.

    From sourcing eco-friendly fabrics to using sustainable packaging, we are committed to reducing our environmental impact.
    We work with artisans who practice traditional, low-impact dyeing and weaving methods. Together, we are proving that
    luxury and sustainability can go hand in hand.`,
  },
  {
    id: 3,
    title: 'How to Style Your Kurti: 5 Modern Looks',
    excerpt: 'Transform your kurti from traditional to trendy with these styling tips.',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=300&fit=crop',
    date: '2024-01-10',
    category: 'Style Tips',
    author: 'Anjali Desai',
    content: `Kurtis are versatile pieces that can be styled in so many ways. Here are 5 modern styling ideas:

    1. Casual Chic: Pair with jeans and sneakers for an effortless everyday look.
    2. Office Ready: Style with tailored pants and blazer for a professional appearance.
    3. Party Perfect: Add jewelry and heels to elevate your kurti for evening events.
    4. Layered Look: Wear over a t-shirt with a denim jacket for a contemporary twist.
    5. Boho Vibes: Combine with loose pants and ethnic accessories for a bohemian aesthetic.`,
  },
];

export const BlogPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(fallbackBlogPosts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadBlog = async () => {
      try {
        const data = await getBlog();
        if (mounted && Array.isArray(data) && data.length > 0) {
          setBlogPosts(data as BlogPost[]);
        }
      } catch (error) {
        console.error('Failed to fetch blog posts', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadBlog();

    return () => {
      mounted = false;
    };
  }, []);

  if (selectedPost) {
    return (
      <div className="page-modal">
        <div className="page-container">
          <button className="close-btn" onClick={() => setSelectedPost(null)}>x</button>

          <div className="page-content">
            <button className="back-btn" onClick={() => setSelectedPost(null)}>Back to Blog</button>

            <article className="blog-post-full">
              <img src={selectedPost.image} alt={selectedPost.title} className="post-image-full" />

              <div className="post-meta">
                <span className="post-category">{selectedPost.category}</span>
                <span className="post-date">
                  {new Date(selectedPost.date).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span className="post-author">By {selectedPost.author}</span>
              </div>

              <h1>{selectedPost.title}</h1>

              <div className="post-content">
                {selectedPost.content.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph.trim()}</p>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-modal">
      <div className="page-container">
        <button className="close-btn" onClick={onClose}>x</button>

        <div className="page-content">
          <h1>SheKurti Blog</h1>
          <p className="page-subtitle">Stories, tips, and inspiration for modern Indian women</p>

          {loading ? <p>Loading blog posts...</p> : null}

          <div className="blog-grid">
            {blogPosts.map((post) => (
              <article key={post.id} className="blog-card" onClick={() => setSelectedPost(post)}>
                <img src={post.image} alt={post.title} />

                <div className="blog-content">
                  <span className="blog-category">{post.category}</span>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>

                  <div className="blog-footer">
                    <span className="blog-date">
                      {new Date(post.date).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <button className="read-more">Read More -&gt;</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
