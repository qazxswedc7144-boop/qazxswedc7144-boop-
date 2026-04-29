
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class Logo extends StatelessWidget {
  final double size;

  const Logo({Key? key, this.size = 40}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      child: Stack(
        children: [
          Transform.rotate(
            angle: -0.05, // Slight rotation
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E4D4D), Color(0xFF10B981)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 10,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
            ),
          ),
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.all(2.0),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black12,
                      blurRadius: 5,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: Center(
                  child: SvgPicture.string(
                    '''
                    <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                      <defs>
                        <linearGradient id='brandGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
                          <stop offset='0%' stop-color='#1E4D4D' />
                          <stop offset='100%' stop-color='#10B981' />
                        </linearGradient>
                      </defs>
                      <path d='M10.5 2V8.5H4V15.5H10.5V22H17.5V15.5H24V8.5H17.5V2H10.5Z' fill='url(#brandGradient)' opacity='0.9' />
                      <path d='M4 12C8 12 10 9 14 9C18 9 20 12 24 12' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' />
                    </svg>
                    ''',
                    width: size * 0.6,
                    height: size * 0.6,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class BrandName extends StatelessWidget {
  final String className;
  const BrandName({Key? key, this.className = ''}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: const TextSpan(
        style: TextStyle(
          fontWeight: FontWeight.w900, // font-black
          letterSpacing: -0.5, // tracking-tighter
          fontSize: 24
        ),
        children: [
          TextSpan(
            text: 'Pharma',
            style: TextStyle(color: Color(0xFF1E4D4D)),
          ),
          TextSpan(
            text: 'Flow',
            style: TextStyle(color: Color(0xFF10B981)),
          ),
        ],
      ),
    );
  }
}

class Tagline extends StatelessWidget {
  final String className;
  const Tagline({Key? key, this.className = ''}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return const Text(
      'Smart Logistics • Precision Data • Streamlined Workflows',
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.bold,
        color: Colors.grey,
        letterSpacing: 1.5, // tracking-widest
      ),
    );
  }
}
